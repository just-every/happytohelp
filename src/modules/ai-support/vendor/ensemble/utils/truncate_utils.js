function isBase64Like(str) {
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    const sample = str.substring(0, 100);
    return base64Regex.test(sample.replace(/\s/g, ''));
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return bytes + ' bytes';
    if (bytes < 1048576)
        return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
export const truncateLargeValues = (obj, maxLength = 1000) => {
    if (typeof obj === 'string') {
        if (obj.length > maxLength && (obj.startsWith('data:image/') || isBase64Like(obj))) {
            const start = obj.substring(0, 50);
            const end = obj.substring(obj.length - 50);
            return `${start}...[truncated ${formatBytes(obj.length)}]...${end}`;
        }
        if (obj.length > maxLength) {
            const halfLength = Math.floor(maxLength / 2);
            const start = obj.substring(0, halfLength);
            const end = obj.substring(obj.length - halfLength);
            return `${start}...[truncated ${obj.length - maxLength} chars]...${end}`;
        }
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => truncateLargeValues(item, maxLength));
    }
    if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = truncateLargeValues(value, maxLength);
        }
        return result;
    }
    return obj;
};
