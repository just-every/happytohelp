'use strict';
const path=require('node:path');
const SNAPSHOT_ROOT=path.join(__dirname,'fixtures/baseline');
const replaceOnce = (source, from, to, label) => {
    if (!source.includes(from)) throw new Error(`Unable to reconstruct legacy-ui ${label}.`);
    return source.replace(from, to);
};

const instrumentAgentSuggestionTrace = source => {
    const start = source.indexOf('const agentSuggestions = async');
    const end = source.indexOf('const describeHumanAgent', start);
    if (start === -1 || end === -1) throw new Error('Unable to find frozen agentSuggestions for evaluation trace instrumentation.');
    const segment = source.slice(start, end);
    const withTrace = replaceOnce(
        segment,
        '        options,\n    });',
        '        options,\n        trace: options?.trace,\n    });',
        'agentSuggestions trace forwarding',
    );
    const instrumented = replaceOnce(
        withTrace,
        '        messages: optimizeMessages(messages),',
        [
            '        messages: (() => {',
            '            const outgoingMessages = optimizeMessages(messages);',
            '            try { options?.trace?.onRequestMessages?.(outgoingMessages); } catch {}',
            '            return outgoingMessages;',
            '        })(),',
        ].join('\n'),
        'agentSuggestions outgoing-message observation',
    );
    return source.slice(0, start) + instrumented + source.slice(end);
};


const loadBaselineAgentSuggestions=async()=>input=>require('./native-client').runCase({...input,variant:'baseline'});
const loadLegacyUiAgentSuggestions=async()=>input=>require('./native-client').runCase({...input,variant:'legacy-ui'});
module.exports={SNAPSHOT_ROOT,instrumentAgentSuggestionTrace,loadBaselineAgentSuggestions,loadLegacyUiAgentSuggestions};
