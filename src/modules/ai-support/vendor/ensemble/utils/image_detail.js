const DETAIL_RANK = {
    low: 1,
    medium: 2,
    high: 3,
    original: 4,
};
export function mapOpenAIImageDetail(detail) {
    if (!detail)
        return undefined;
    if (detail === 'medium')
        return 'high';
    return detail;
}
export function mapOpenAIChatImageDetail(detail) {
    if (!detail)
        return undefined;
    if (detail === 'medium' || detail === 'original')
        return 'high';
    return detail;
}
export function mapOpenAIImageInputFidelity(detail) {
    if (!detail || detail === 'auto')
        return undefined;
    if (detail === 'original')
        return 'high';
    return detail;
}
export function mapGeminiMediaResolution(detail) {
    switch (detail) {
        case 'low':
            return 'MEDIA_RESOLUTION_LOW';
        case 'medium':
            return 'MEDIA_RESOLUTION_MEDIUM';
        case 'high':
        case 'original':
            return 'MEDIA_RESOLUTION_HIGH';
        case 'auto':
        default:
            return undefined;
    }
}
export function chooseHighestImageDetail(details) {
    let selected;
    for (const detail of details) {
        if (!detail || detail === 'auto')
            continue;
        if (!selected || DETAIL_RANK[detail] > DETAIL_RANK[selected]) {
            selected = detail;
        }
    }
    return selected;
}
function collectDetailsFromContent(content) {
    if (!Array.isArray(content))
        return [];
    return content.filter(item => item.type === 'input_image' || item.type === 'image').map(item => item.detail);
}
export function chooseImageDetailFromInput(input) {
    const details = [];
    for (const item of input) {
        if ('content' in item) {
            details.push(...collectDetailsFromContent(item.content));
        }
    }
    return chooseHighestImageDetail(details);
}
