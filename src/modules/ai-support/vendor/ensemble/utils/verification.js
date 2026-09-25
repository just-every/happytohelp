import { validateJsonResponseContent } from './json_schema.js';
let ensembleRequestFunction = null;
export function setEnsembleRequestFunction(fn) {
    ensembleRequestFunction = fn;
}
export async function verifyOutput(verifier, output, originalMessages) {
    const verificationSchema = {
        type: 'object',
        properties: {
            status: { type: 'string', enum: ['pass', 'fail'] },
            reason: { type: 'string' },
        },
        required: ['status'],
        additionalProperties: false,
    };
    const verificationPrompt = `Please verify if the following output is correct and complete:

${output}

Respond with JSON: {"status": "pass"} or {"status": "fail", "reason": "explanation of what is wrong"}`;
    const verificationMessages = [
        ...originalMessages,
        {
            type: 'message',
            role: 'assistant',
            content: output,
            status: 'completed',
        },
        {
            type: 'message',
            role: 'user',
            content: verificationPrompt,
        },
    ];
    const verifierWithSchema = {
        ...verifier,
        modelSettings: {
            ...verifier.modelSettings,
            json_schema: {
                type: 'json_schema',
                name: 'verification_result',
                strict: true,
                schema: verificationSchema,
            },
        },
    };
    if (!ensembleRequestFunction) {
        throw new Error('Ensemble request function not set. This is a circular dependency issue.');
    }
    try {
        const stream = ensembleRequestFunction(verificationMessages, verifierWithSchema);
        let fullResponse = '';
        for await (const event of stream) {
            if (event.type === 'message_complete' && 'content' in event) {
                fullResponse = event.content;
            }
        }
        const validation = validateJsonResponseContent(fullResponse, verificationSchema);
        if ('error' in validation) {
            return {
                status: 'fail',
                reason: validation.error,
            };
        }
        return validation.value;
    }
    catch (error) {
        console.error('Verification failed:', error);
        return {
            status: 'fail',
            reason: error instanceof Error ? error.message : 'Invalid verification response',
        };
    }
}
