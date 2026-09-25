

const MAX_PRIMARY_TOOL_EVIDENCE_CHARS = 48 * 1024;

const toolNameFor = event => event?.tool_call?.function?.name || null;

const toolOutputFor = event => {
    const output = event?.result?.output;
    if (typeof output === 'string') return output;
    if (output === null || output === undefined) return null;
    try {
        return JSON.stringify(output);
    } catch {
        return null;
    }
};

const createPrimaryToolEvidenceCollector = () => {
    const outputs = [];
    let usedChars = 0;
    let omittedOutputCount = 0;

    const record = event => {
        if (event?.type !== 'tool_done' || event?.result?.error) return;

        const toolName = toolNameFor(event);
        const output = toolOutputFor(event);
        if (!toolName || !output || toolName === 'find_reply_icons') return;

        if (usedChars + output.length > MAX_PRIMARY_TOOL_EVIDENCE_CHARS) {
            omittedOutputCount += 1;
            return;
        }

        outputs.push({
            tool: toolName,
            call_id: event?.result?.call_id || event?.tool_call?.call_id || event?.tool_call?.id || null,
            output,
        });
        usedChars += output.length;
    };

    const snapshot = () => ({
        source: 'primary-pass-tool-results',
        output_char_budget: MAX_PRIMARY_TOOL_EVIDENCE_CHARS,
        output_chars: usedChars,
        outputs: outputs.map(item => ({ ...item })),
        omitted_output_count: omittedOutputCount,
    });

    return { record, snapshot };
};

export {
    MAX_PRIMARY_TOOL_EVIDENCE_CHARS,
    createPrimaryToolEvidenceCollector,
};
