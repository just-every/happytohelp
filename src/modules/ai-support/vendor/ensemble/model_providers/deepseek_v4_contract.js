export function applyDeepSeekV4Contract(requestParams) {
    const params = requestParams;
    if (!params.model.startsWith('deepseek-v4-'))
        return params;
    const effort = params.reasoning?.effort;
    delete params.reasoning;
    if (effort === 'none' || effort === 'disabled') {
        params.thinking = { type: 'disabled' };
        delete params.reasoning_effort;
        return params;
    }
    params.thinking = { type: 'enabled' };
    params.reasoning_effort = effort === 'max' ? 'max' : effort === 'low' || effort === 'minimal' ? 'low' : 'high';
    return params;
}
