

import { replyIcons } from '../llm/schemas/reply-icons.js';

const COMMON_REPLY_ICONS = ['message-circle', 'circle-question-mark', 'circle-check', 'search', 'list-checks', 'receipt', 'credit-card', 'calendar', 'clock', 'shield-check', 'wrench', 'heart-handshake', 'file-text', 'mail', 'arrow-right'];

const findReplyIcons = query => {
    const terms = String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return replyIcons.map(name => ({
        name,
        score: terms.reduce((score, term) => score + (name === term ? 10 : name.split('-').includes(term) ? 3 : name.includes(term) ? 1 : 0), 0),
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 24).map(item => item.name);
};

const replyIconTool = () => {
    let searched = false;
    return {
        isAvailable: () => !searched,
        definition: { type: 'function', function: {
            name: 'find_reply_icons',
            description: 'Find canonical Lucide icon names in the complete icon library. This lookup is available once per generation; combine useful visual concepts in one query. It selects presentation only and provides no customer facts.',
            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
        } },
        function: async query => {
            searched = true;
            return JSON.stringify({ icons: findReplyIcons(query), lookup_complete: true, other_allowed_icons: COMMON_REPLY_ICONS });
        },
    };
};

export { COMMON_REPLY_ICONS, findReplyIcons, replyIconTool };
