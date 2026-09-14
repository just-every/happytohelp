'use strict';

const SUMMARY_FAILURE_MARKER = '[Summary generation failed, output truncated]';

const auditToolSummaryPaths = toolCalls => {
    const signals = (toolCalls || []).flatMap(call => {
        const output = call?.type === 'tool_done' ? call?.result?.output : null;
        if (typeof output !== 'string' || !output.includes(SUMMARY_FAILURE_MARKER)) return [];
        return [{
            tool_name: call.name || null,
            call_id: call.call_id || null,
            output_length: output.length,
            status: 'summary_path_failed',
        }];
    });

    return {
        attempted_count: signals.length,
        unmetered: signals.length > 0,
        signals,
    };
};

module.exports = { auditToolSummaryPaths };
