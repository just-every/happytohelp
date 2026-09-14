// Pure checker retained from the original human-voice evaluation harness.
const asText = value => typeof value === 'string' ? value : '';

const normalizeText = value => asText(value)
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeSemanticText = value => asText(value).replace(/[‘’]/g, "'");

const containsPhrase = (text, phrase) => normalizeText(text).includes(normalizeText(phrase));

const extractResponseTexts = output => {
    if (typeof output === 'string') return output.trim() ? [output.trim()] : [];
    if (typeof output?.response === 'string') return output.response.trim() ? [output.response.trim()] : [];
    const responses = output?.responses || output?.output?.responses || output?.result?.responses;
    if (!Array.isArray(responses)) return [];
    return responses
        .map(response => typeof response === 'string' ? response : response?.response || response?.content || response?.text)
        .filter(response => typeof response === 'string' && response.trim())
        .map(response => response.trim());
};

const BOT_REHANDOFF_PATTERNS = [
    /\b(?:i|we)\s+(?:have\s+)?(?:asked|requested|arranged for|will ask)\s+(?:another\s+|a\s+)?(?:human|representative|person|agent|teammate)\b/i,
    /\b[A-Z][a-z]{1,30}\s+has\s+(?:asked|requested|arranged for)\s+(?:another\s+|a\s+)?(?:human|representative|person|agent|teammate)\b/,
    /\b(?:i|we)(?:'ll| will)\s+have\s+(?:another\s+|a\s+|the\s+)?(?:human|representative|person|agent|teammate)\b[^.!?]{0,100}\b(?:review|check|investigate|take over|help|contact|reach out|follow up|handle|assist)\b/i,
    /\b(?:another|a different|a separate|the next|a new)\s+(?:human|representative|person|agent|teammate)\b[^.!?]{0,100}\b(?:will|can|is going to|should)\b[^.!?]{0,100}\b(?:take over|help|contact|reach out|follow up|handle|assist|be in touch)\b/i,
    /\b(?:a|the)\s+(?:human representative|support agent|support person|human teammate)\s+(?:will|can|is going to|should)\b[^.!?]{0,100}\b(?:take over|help|contact|reach out|follow up|handle|assist|be in touch)\b/i,
    /\b(?:you(?:'ll| will)|your request will)\s+be\s+(?:handed|passed|escalated)\s+(?:to|on to)\s+(?:another\s+|a\s+)?(?:human|representative|person|agent|teammate)\b/i,
    /\bto\s+help\s+(?:another\s+|a\s+|the\s+)?(?:human|representative|person|agent|teammate)\b/i,
    /\b(?:i|we)(?:'ll| will)\s+(?:keep|leave)\b[^.!?]{0,80}\b(?:for|with)\s+(?:the|our)\s+team\b[.!?]\s*[^.!?]{0,160}\bthey(?:'ll| will)\s+(?:focus|review|check|investigate|take over|help|contact|reach out|follow up|handle|assist)\b/i,
];

const OPERATOR_OWNERSHIP_PATTERNS = [
    /\b(?:i|we)(?:'ll| will| can| am| are| need to| plan to)\b[^.!?]{0,120}\b(?:review|check|investigate|look into|follow up|update|handle|help|coordinate|work on|continue|resolve|confirm|take (?:it|this) from here)\b/i,
    /\b(?:i|we)\s+(?:review|check|investigate|follow up|update|handle|help|coordinate|continue|resolve|confirm)\b/i,
];

const USEFUL_DETAIL_REQUEST_PATTERNS = [
    /\b(?:could|can|would)\s+you\s+(?:share|confirm|provide)\b/i,
    /\bplease\s+(?:share|confirm|provide)\b/i,
    /\b(?:what|which)\s+(?:order|account|email|invoice|delivery|reference)\b/i,
];

const assumesHumanName = text => {
    const match = normalizeSemanticText(text).match(/\b(?:[Tt]his is|[Ii](?:'m| am))\s+([A-Z][a-z]{1,30})(?=$|[,.!]|\s+(?:and|from|with)\b)/);
    if (!match) return false;
    return !new Set(['Able', 'Glad', 'Happy', 'Ready', 'Sorry']).has(match[1]);
};

const evaluateHumanVoice = (caseDefinition, output) => {
    const responses = extractResponseTexts(output);
    const failures = [];
    const expected = caseDefinition?.expected || {};

    if (responses.length === 0) failures.push({ check: 'response_required' });

    responses.forEach((response, responseIndex) => {
        const semanticText = normalizeSemanticText(response);
        const operatorOwnsNextStep = OPERATOR_OWNERSHIP_PATTERNS.some(pattern => pattern.test(semanticText));
        const asksUsefulDetail = USEFUL_DETAIL_REQUEST_PATTERNS.some(pattern => pattern.test(semanticText));
        if (expected.requires_operator_ownership && !operatorOwnsNextStep && !asksUsefulDetail) {
            failures.push({ check: 'operator_owns_next_step', response_index: responseIndex, actual: response });
        }
        if (expected.forbids_bot_rehandoff) {
            const rehandoff = BOT_REHANDOFF_PATTERNS.find(pattern => pattern.test(semanticText));
            if (rehandoff) {
                failures.push({ check: 'bot_rehandoff', response_index: responseIndex, actual: rehandoff.source });
            }
        }
        const forbiddenName = (expected.forbidden_sender_names || []).find(name => containsPhrase(response, name));
        if (forbiddenName) {
            failures.push({ check: 'selected_ai_as_sender', response_index: responseIndex, actual: forbiddenName });
        }
        if (expected.forbids_assumed_human_name && assumesHumanName(response)) {
            failures.push({ check: 'assumed_human_name', response_index: responseIndex, actual: response });
        }
    });

    const specialistTerms = expected.requires_downstream_specialist || [];
    if (specialistTerms.length && !responses.some(response => specialistTerms.some(term => containsPhrase(response, term)))) {
        failures.push({ check: 'downstream_specialist', expected: specialistTerms, actual: responses });
    }

    return {
        passed: failures.length === 0,
        failures,
        response_count: responses.length,
        responses,
    };
};


export {evaluateHumanVoice};
