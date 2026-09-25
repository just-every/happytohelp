import {
    escapeHtmlAttribute,
    normalisePublicConfig,
    serializeForScript,
} from './publicConfig';

function buildAnonymousEmbedCode(publicConfig) {
    const config = normalisePublicConfig(publicConfig);
    const init = {widgetKey: config.widgetKey, apiOrigin: config.apiOrigin};

    return [
        '<script>',
        '  window.h2hQueue = window.h2hQueue || [];',
        '  function h2h() { window.h2hQueue.push(arguments); }',
        `  h2h('init', ${serializeForScript(init, 2).replace(/\n/g, '\n  ')});`,
        '</script>',
        '<div id="happytohelp"></div>',
        `<script src="${escapeHtmlAttribute(config.scriptUrl)}" async></script>`,
    ].join('\n');
}

export { buildAnonymousEmbedCode };
