'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { evidenceIdsForPacket } = require('../../src/modules/ai-support/assist/packet.js');

const FIXTURE_PATH = path.join(__dirname, '..', '..', 'tests', 'eval-harness', 'fixtures', 'assist-human-voice.json');
const FIXTURE_SCHEMA = 'happytohelp.assist-human-voice.v1';
const FIXTURE_NAMESPACE = 'happytohelp.synthetic-assist-human-voice.v1';

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

const loadFixture = (fixturePath = FIXTURE_PATH) => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const failures = validateFixture(fixture);
    if (failures.length) throw new Error(`Human-voice fixture validation failed: ${failures.join('; ')}`);
    return fixture;
};

const validateFixture = fixture => {
    const failures = [];
    if (!fixture || typeof fixture !== 'object') return ['fixture must be an object'];
    if (fixture.schema_version !== FIXTURE_SCHEMA) failures.push('unexpected schema_version');
    if (fixture.namespace !== FIXTURE_NAMESPACE) failures.push('unexpected namespace');
    if (!Array.isArray(fixture.cases) || fixture.cases.length === 0) {
        failures.push('fixture must define focused cases');
    }

    const ids = new Set();
    for (const item of fixture.cases || []) {
        if (!item?.id || !/^[a-z0-9_]+$/.test(item.id)) {
            failures.push(`invalid case id '${item?.id || ''}'`);
            continue;
        }
        if (ids.has(item.id)) failures.push(`duplicate case id '${item.id}'`);
        ids.add(item.id);
        if (!item.customer?.email?.endsWith('@example.test')) {
            failures.push(`${item.id}: contact email must use example.test`);
        }
        if (!Array.isArray(item.messages) || item.messages.length < 3) {
            failures.push(`${item.id}: at least three typed messages are required`);
        }
        if (!['suggestions', 'complete'].includes(item.mode)) {
            failures.push(`${item.id}: mode must be suggestions or complete`);
        }
        if (!item.expected || typeof item.expected !== 'object') {
            failures.push(`${item.id}: expected semantic checks are required`);
        }
        if (!item.selected_ai?.prompt || typeof item.selected_ai.prompt !== 'string') {
            failures.push(`${item.id}: selected AI prompt is required`);
        }
        if (!item.messages?.some(message => message.author?.kind === 'ai')) {
            failures.push(`${item.id}: an earlier AI handoff message is required`);
        }
        if (item.messages?.at(-1)?.author?.kind !== 'contact') {
            failures.push(`${item.id}: the latest message must be from the customer`);
        }
    }

    for (const requiredId of ['handoff_thanks', 'no_human_name', 'downstream_specialist', 'draft_edit_handoff']) {
        if (!ids.has(requiredId)) failures.push(`missing required case '${requiredId}'`);
    }
    if (fixture.cases?.find(item => item.id === 'no_human_name')?.human !== null) {
        failures.push('no_human_name must have no configured human identity');
    }
    if (fixture.cases?.find(item => item.id === 'draft_edit_handoff')?.mode !== 'complete') {
        failures.push('draft_edit_handoff must use complete mode');
    }
    return failures;
};

const packetForCase = caseDefinition => {
    const timeline = caseDefinition.messages.map((message, index) => ({
        evidence_id: `message:human-voice/${caseDefinition.id}/${index + 1}`,
        kind: 'message',
        visibility: 'conversation',
        timestamp: message.timestamp,
        author: message.author,
        content: message.content,
        attachments: [],
    }));

    return {
        schema: 'happytohelp.assist-context.v1',
        mode: 'human-draft',
        company: {
            evidence_id: `company:human-voice/${caseDefinition.id}`,
            kind: 'company',
            visibility: 'workspace',
            name: 'Synthetic Support Workspace',
            profile: {},
        },
        conversation: {
            id: `conversation:human-voice/${caseDefinition.id}`,
            project_id: `synthetic-human-voice-${caseDefinition.id}`,
            contact_id: `contact:human-voice/${caseDefinition.id}`,
            assigned_agent_id: caseDefinition.human ? `operator:human-voice/${caseDefinition.id}` : null,
            selected_ai_id: `ai:human-voice/${caseDefinition.id}`,
            resolved_at: null,
        },
        drafting_identity: {
            kind: 'human-operator',
            human: caseDefinition.human ? {
                id: `operator:human-voice/${caseDefinition.id}`,
                name: caseDefinition.human.name,
                profile: {},
            } : null,
            ai_reference: {
                id: `ai:human-voice/${caseDefinition.id}`,
                name: caseDefinition.selected_ai.name,
                role: caseDefinition.selected_ai.role,
                selection: 'synthetic-evaluation',
            },
        },
        customer: {
            evidence_id: `contact:human-voice/${caseDefinition.id}`,
            kind: 'contact',
            visibility: 'conversation',
            name: caseDefinition.customer.name,
            email: caseDefinition.customer.email,
            language: caseDefinition.customer.language,
            profile: {},
        },
        draft: {
            visibility: 'private-to-operators',
            content: caseDefinition.draft || '',
        },
        operator_guidance: {
            visibility: 'private-to-operators',
            content: '',
        },
        timeline,
        history_window: {
            initial_message_count: timeline.length,
            initial_event_count: 0,
            timeline_entry_count: timeline.length,
            timeline_entries_omitted: 0,
            has_older_messages: false,
            has_older_events: false,
            earliest_included_timestamp: timeline[0]?.timestamp || null,
            earliest_included_cursor: timeline[0]
                ? `${timeline[0].timestamp}|${timeline[0].evidence_id}`
                : null,
            retrieval: {
                search_tool: 'search_conversation_history',
                read_tool: 'read_conversation_history',
            },
        },
        private_notes: [],
        activity: [],
        summaries: [],
        knowledge: {
            visibility: 'workspace-knowledge',
            readiness: 'ready',
            source_count: 0,
            catalog: [],
            retrieval: {
                search_tool: 'search_knowledge',
                read_tool: 'read_knowledge_source',
            },
        },
    };
};

const contextForCase = caseDefinition => {
    const packet = packetForCase(caseDefinition);
    const policies = [
        {
            id: 'policy:human-draft',
            source: 'system',
            text: 'Draft for the human operator. Do not present the configured AI as the sender, and do not claim an action occurred unless the supplied evidence proves it.',
        },
        {
            id: `policy:ai:human-voice/${caseDefinition.id}`,
            source: 'server-selected-ai',
            selection: 'synthetic-evaluation',
            ai: {
                id: `ai:human-voice/${caseDefinition.id}`,
                name: caseDefinition.selected_ai.name,
                type: 'ai',
                role: caseDefinition.selected_ai.role,
            },
            text: caseDefinition.selected_ai.prompt,
        },
    ];
    return {
        project_id: `synthetic-human-voice-${caseDefinition.id}`,
        conversation_id: `synthetic-human-voice-${caseDefinition.id}`,
        options: {
            agent_message: caseDefinition.draft || '',
            agent_instructions: '',
        },
        assist: {
            packet,
            policies,
            evidenceIds: new Set([...evidenceIdsForPacket(packet), ...policies.map(policy => policy.id)]),
        },
    };
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

module.exports = {
    FIXTURE_NAMESPACE,
    FIXTURE_PATH,
    FIXTURE_SCHEMA,
    contextForCase,
    evaluateHumanVoice,
    extractResponseTexts,
    loadFixture,
    packetForCase,
    validateFixture,
};
