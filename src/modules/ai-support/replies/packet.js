

import { imageInputsForPacket, packetForMessage } from '../assist/packet.js';

const textValue = value => {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
};

const customerReplyPacket = ({
    assistPacket,
    customerPrompt = '',
    serverInstructions = [],
    repositoryRetrieval = [],
} = {}) => {
    if (!assistPacket || typeof assistPacket !== 'object') {
        throw new TypeError('Customer reply packet requires the scoped context packet.');
    }

    const timeline = Array.isArray(assistPacket.timeline) ? assistPacket.timeline : [];
    const privateNotes = Array.isArray(assistPacket.private_notes) ? assistPacket.private_notes : [];

    return {
        schema: 'happytohelp.customer-reply-context.v1',
        mode: 'autonomous-customer-reply',
        delivery: {
            audience: 'customer',
            format: 'plain-text',
            send_mode: 'direct',
        },
        company: assistPacket.company || null,
        customer: assistPacket.customer || null,
        conversation: assistPacket.conversation || null,
        sender: assistPacket.drafting_identity?.ai_reference || null,
        trigger: {
            customer_prompt: customerPrompt
                ? {
                    visibility: 'customer-provided',
                    content: textValue(customerPrompt),
                }
                : null,
            server_instructions: (Array.isArray(serverInstructions) ? serverInstructions : [])
                .map(textValue)
                .filter(Boolean)
                .map(content => ({ visibility: 'server-trigger', content })),
        },
        evidence: {
            conversation: timeline.filter(entry => entry?.kind === 'message'),
            workflow: timeline.filter(entry => entry?.kind === 'event' && entry?.visibility !== 'private-to-operators'),
            private_notes: privateNotes.map(entry => ({
                ...entry,
                visibility: 'private-to-operators',
            })),
            customer_observations: [
                ...(Array.isArray(assistPacket.activity) ? assistPacket.activity : []),
                ...(Array.isArray(assistPacket.summaries) ? assistPacket.summaries : []),
            ],
            history_window: assistPacket.history_window || null,
            knowledge: assistPacket.knowledge || {
                visibility: 'workspace-knowledge',
                readiness: 'unknown',
                source_count: 0,
                catalog: [],
            },
        },
        capabilities: {
            account_mutations: [],
            handoff: 'switch_agent',
            retrieval: [
                'search_knowledge',
                'read_knowledge_source',
                'read_conversation_history',
                'read_conversation_entry',
                'search_conversation_history',
            ],
            repository_retrieval: Array.isArray(repositoryRetrieval) ? repositoryRetrieval : [],
        },
    };
};

const customerReplyPacketMessageContent = packet => {
    const conversationPacket = {
        timeline: packet?.evidence?.conversation || [],
    };
    const imageInputs = imageInputsForPacket(conversationPacket);
    const safeConversationPacket = packetForMessage(conversationPacket, imageInputs);
    const messagePacket = {
        ...packet,
        evidence: {
            ...(packet?.evidence || {}),
            conversation: safeConversationPacket.timeline,
        },
    };
    const parts = [{
        type: 'text',
        text: `Scoped customer-reply context:\n${JSON.stringify(messagePacket, (key, value) => (
            key === 'provider_image_url'
            || ((key === 'url' || key === 'preview_url') && typeof value === 'string' && /^data:/i.test(value))
                ? undefined
                : value
        ))}`,
    }];

    for (const image of imageInputs) {
        parts.push({
            type: 'text',
            text: `The next image is customer conversation evidence ${image.evidence_id}.`,
        });
        parts.push({ type: 'image_url', image_url: { url: image.url } });
    }

    return parts.length === 1 ? parts[0].text : parts;
};

export {
    customerReplyPacket,
    customerReplyPacketMessageContent,
};
