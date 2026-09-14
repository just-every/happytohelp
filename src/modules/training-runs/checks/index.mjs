'use strict';

import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

const NAMESPACE = 'happytohelp.synthetic-eval.v1';
const URL_UUID_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

const asText = value => typeof value === 'string' ? value : '';

const normalizeText = value => asText(value)
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const containsPhrase = (text, phrase) => normalizeText(text).includes(normalizeText(String(phrase)));

const extractResponseObjects = output => {
    const candidate = output?.responses || output?.output?.responses || output?.result?.responses;
    if (!Array.isArray(candidate)) return [];
    return candidate.map((item, index) => {
        if (typeof item === 'string') return { index, text: item, evidence_ids: [] };
        return {
            index,
            text: asText(item?.response || item?.content || item?.text),
            evidence_ids: Array.isArray(item?.evidence_ids) ? item.evidence_ids.filter(id => typeof id === 'string') : [],
        };
    }).filter(item => item.text);
};

const extractResponses = output => extractResponseObjects(output).map(item => item.text);

const uuidBytes = uuid => Buffer.from(uuid.replace(/-/g, ''), 'hex');

const uuidV5 = name => {
    const hash = crypto.createHash('sha1')
        .update(uuidBytes(URL_UUID_NAMESPACE))
        .update(Buffer.from(name, 'utf8'))
        .digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const value = hash.subarray(0, 16).toString('hex');
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};

const seededId = key => uuidV5(`${NAMESPACE}/${key}`);

const fixtureEvidenceId = documentId => {
    if (String(documentId).startsWith('knowledge:')) return String(documentId);
    if (String(documentId).startsWith('message:')) {
        const messageKey = String(documentId).slice('message:'.length);
        return `message:${seededId(`message/${messageKey}`)}`;
    }
    const dataset = documentId === 'returns-policy-draft'
        ? 'dataset/draft'
        : documentId === 'other-workspace-policy'
            ? 'dataset/restricted'
            : 'dataset/ready';
    const fileId = seededId(`dataset-file/${seededId(dataset)}/${documentId}`);
    return `knowledge:${fileId}`;
};

const evidenceIds = result => {
    const output = result?.output || result;
    const responseEvidence = extractResponseObjects(output).flatMap(item => item.evidence_ids);
    const candidate = [
        ...(Array.isArray(result?.evidence_ids) ? result.evidence_ids : []),
        ...(Array.isArray(output?.evidence_ids) ? output.evidence_ids : []),
        ...responseEvidence,
        ...(Array.isArray(result?.trace?.evidence_ids) ? result.trace.evidence_ids : []),
    ];
    return new Set(candidate.filter(id => typeof id === 'string'));
};

const sentenceCount = text => {
    const marks = asText(text).match(/[.!?]+(?=\s|$)/g);
    return marks?.length || (asText(text).trim() ? 1 : 0);
};

const spanishSignal = text => /[¿¡áéíóúñ]|\b(?:gracias|puedo|puedes|pueden|podemos|podria|podría|por favor|necesito|compart[ei]|comparta|indicar|confirmar|revisar|cuenta|correo)\b/i.test(text);

const asksForLocatorDetail = (text, language) => {
    const locator = language === 'es'
        ? /\b(?:numero|número)\s+de\s+(?:pedido|orden)|\b(?:pedido|cuenta|correo|direcci[oó]n|referencia|seguimiento)\b/i.test(text)
        : /\b(order|account|email|postal|zip|address|reference|tracking)\b/i.test(text);
    const question = language === 'es'
        ? /[¿?]|\b(?:puedes|podrias|podrías|podemos|comparta|indique|confirme)\b/i.test(text)
        : /\?|\b(?:could you|can you|please (?:share|provide|confirm)|what(?:'s| is)|which|may i have)\b/i.test(text);
    return locator && question;
};

const possibleCompletionClaim = text => {
    const patterns = [
        /\b(?:i|we|our team)\s+(?:have |has |already |just )?(?:completed|processed|approved|cancelled|changed|updated|contacted|sent|refunded)\b/i,
        /\b(?:your|the)\s+(?:refund|order|address|request|cancellation)\b.{0,70}\b(?:has been|was)\s+(?:completed|processed|approved|cancelled|changed|updated)\b/i,
    ];
    return patterns.some(pattern => pattern.test(text));
};

const perReplyFailure = (failures, check, response, details = {}) => {
    failures.push({ check, response_index: response.index, ...details });
};

const failureBucket = (classification, qualityFailures, harnessFailures) => (
    classification === 'harness' ? harnessFailures : qualityFailures
);

const evaluateSuggestion = (caseDefinition, result) => {
    const expected = caseDefinition?.expected || {};
    const responses = extractResponseObjects(result?.output || result);
    const qualityFailures = [];
    const harnessFailures = [];
    const manualReviewFlags = [];
    const cardFailures = failureBucket(expected.cardinality_classification, qualityFailures, harnessFailures);

    const minResponses = Number.isInteger(expected.min_responses) ? expected.min_responses : 1;
    const maxResponses = Number.isInteger(expected.max_responses) ? expected.max_responses : 4;
    if (responses.length < minResponses || responses.length > maxResponses) {
        cardFailures.push({ check: 'response_cardinality', expected: `${minResponses}-${maxResponses}`, actual: responses.length });
    }

    const requiredAny = expected.must_include_any || [];
    const requiredAll = expected.must_include_all || [];
    const prohibited = [...(expected.must_not_include || []), ...(expected.must_not_include_any_response || [])];
    const privatePatterns = (expected.private_disclosure_patterns || []).map(pattern => new RegExp(pattern, 'i'));
    const responseFailures = [];
    for (const response of responses) {
        if (requiredAny.length && !requiredAny.some(phrase => containsPhrase(response.text, phrase))) {
            perReplyFailure(responseFailures, 'must_include_any_per_reply', response, { expected: requiredAny });
        }
        const missingAll = requiredAll.filter(phrase => !containsPhrase(response.text, phrase));
        if (missingAll.length) {
            perReplyFailure(responseFailures, 'must_include_all_per_reply', response, { expected: missingAll });
        }
        const foundProhibited = prohibited.filter(phrase => containsPhrase(response.text, phrase));
        if (foundProhibited.length) {
            perReplyFailure(responseFailures, 'must_not_include_per_reply', response, { actual: foundProhibited });
        }
        const leakedPrivatePattern = privatePatterns.filter(pattern => pattern.test(response.text)).map(pattern => pattern.source);
        if (leakedPrivatePattern.length) {
            perReplyFailure(responseFailures, 'private_note_disclosure_per_reply', response, { actual: leakedPrivatePattern });
        }
        if (expected.language === 'es' && !spanishSignal(response.text)) {
            perReplyFailure(responseFailures, 'language_es_per_reply', response, { actual: response.text.slice(0, 180) });
        }
        if (expected.requires_question && !asksForLocatorDetail(response.text, expected.language)) {
            perReplyFailure(responseFailures, 'requires_locator_question_per_reply', response);
        }
        if (Number.isInteger(expected.max_sentences) && sentenceCount(response.text) > expected.max_sentences) {
            perReplyFailure(responseFailures, 'max_sentences_per_reply', response, { expected: expected.max_sentences, actual: sentenceCount(response.text) });
        }
        if (possibleCompletionClaim(response.text)) {
            manualReviewFlags.push({ check: 'possible_unobserved_completion_claim', response_index: response.index, actual: response.text.slice(0, 240) });
        }
        if (expected.language === 'es' && /\b(?:the|your|we|can|please|order|tracking)\b/i.test(response.text)) {
            manualReviewFlags.push({ check: 'possible_language_mismatch', response_index: response.index, actual: response.text.slice(0, 240) });
        }
    }
    qualityFailures.push(...responseFailures);

    const foundEvidence = evidenceIds(result);
    const requiredEvidence = (expected.required_evidence_ids || []).map(fixtureEvidenceId);
    const forbiddenEvidence = (expected.forbidden_evidence_ids || []).map(fixtureEvidenceId);
    const evidenceFailures = failureBucket(result?.variant === 'prototype' ? undefined : 'harness', qualityFailures, harnessFailures);
    for (const response of responses) {
        const responseEvidence = new Set(response.evidence_ids);
        const missingEvidence = requiredEvidence.filter(id => !responseEvidence.has(id));
        if (missingEvidence.length) {
            evidenceFailures.push({
                check: 'required_evidence_ids_per_reply',
                response_index: response.index,
                expected: missingEvidence,
                actual: Array.from(responseEvidence),
            });
        }
    }
    const foundForbiddenEvidence = forbiddenEvidence.filter(id => foundEvidence.has(id));
    if (foundForbiddenEvidence.length) {
        qualityFailures.push({ check: 'forbidden_evidence_ids', actual: foundForbiddenEvidence });
    }

    const observedToolNames = new Set((result?.toolCalls || []).map(tool => tool?.name).filter(Boolean));
    const missingTools = (expected.required_tool_names || []).filter(name => !observedToolNames.has(name));
    if (missingTools.length) {
        const toolFailures = failureBucket(result?.variant === 'prototype' ? undefined : 'harness', qualityFailures, harnessFailures);
        toolFailures.push({ check: 'required_tool_names', expected: missingTools, actual: Array.from(observedToolNames) });
    }
    const toolAlternatives = expected.required_tool_names_any || [];
    if (toolAlternatives.length && !toolAlternatives.some(name => observedToolNames.has(name))) {
        const toolFailures = failureBucket(result?.variant === 'prototype' ? undefined : 'harness', qualityFailures, harnessFailures);
        toolFailures.push({ check: 'required_tool_names_any', expected: toolAlternatives, actual: Array.from(observedToolNames) });
    }

    if (expected.requires_native_image && !(result?.imageInputs || []).length) {
        failureBucket(expected.native_image_classification, qualityFailures, harnessFailures)
            .push({ check: 'native_image_input', expected: 'at least one provider image input', actual: result?.imageInputs || [] });
    }

    return {
        passed: qualityFailures.length === 0,
        quality_failures: qualityFailures,
        harness_failures: harnessFailures,
        failures: [...qualityFailures, ...harnessFailures],
        manual_review_flags: manualReviewFlags,
        response_count: responses.length,
        response_digest: crypto.createHash('sha256').update(responses.map(response => response.text).join('\n')).digest('hex'),
        evidence_ids: Array.from(foundEvidence),
    };
};

export {
    NAMESPACE,
    evidenceIds,
    extractResponseObjects,
    extractResponses,
    fixtureEvidenceId,
    evaluateSuggestion,
    seededId,
};
