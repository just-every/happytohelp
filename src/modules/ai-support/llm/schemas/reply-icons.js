import replyIcons from './reply-icons-data.js';

const replyIconNames = new Set(replyIcons);
const replyIconCatalogueInstruction = [
    'Every reply must use exactly one canonical Lucide icon name from this complete catalogue. Choose by the reply approach and intent, never by an unverified claim or a guessed topic. Use distinct icons when the reply approaches differ.',
    '',
    `Canonical Lucide icon names (${ replyIcons.length }):`,
    replyIcons.join(', '),
].join('\n');

export {
    replyIcons,
    replyIconNames,
    replyIconCatalogueInstruction,
};
