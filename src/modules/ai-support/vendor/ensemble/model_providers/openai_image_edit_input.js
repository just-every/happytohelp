import { toFile } from 'openai';
const sourceFilename = (source, index) => {
    if (typeof source === 'string' || !source.metadata)
        return `image_${index}.png`;
    const parts = [
        source.metadata.category,
        source.metadata.title?.replace(/[^a-zA-Z0-9-_]/g, '_'),
        source.metadata.id === undefined ? undefined : `id${source.metadata.id}`,
    ].filter((part) => Boolean(part));
    return parts.length > 0 ? `${parts.join('_')}.png` : `image_${index}.png`;
};
const sourceData = (source) => (typeof source === 'string' ? source : source.data);
const base64Image = (value) => {
    if (!value.startsWith('data:')) {
        return { bytes: new Uint8Array(Buffer.from(value, 'base64')), mime: 'image/png' };
    }
    const match = /^data:([^;]+);base64,(.+)$/i.exec(value);
    if (!match?.[2])
        throw new TypeError('OpenAI source image data URL must contain base64 image bytes.');
    return {
        bytes: new Uint8Array(Buffer.from(match[2], 'base64')),
        mime: match[1] || 'image/png',
    };
};
const prepareSourceFile = async (source, index, signal) => {
    const data = sourceData(source);
    const filename = sourceFilename(source, index);
    if (data.startsWith('http://') || data.startsWith('https://')) {
        const response = await fetch(data, { signal });
        if (!response.ok) {
            throw Object.assign(new Error(`OpenAI source image download failed with HTTP ${response.status}.`), {
                status: response.status,
            });
        }
        return await toFile(new Uint8Array(await response.arrayBuffer()), filename, {
            type: response.headers.get('content-type') || 'image/png',
        });
    }
    const decoded = base64Image(data);
    return await toFile(decoded.bytes, filename, { type: decoded.mime });
};
const prepareMaskFile = async (mask) => {
    if (!mask)
        return undefined;
    const decoded = base64Image(mask);
    return await toFile(decoded.bytes, 'mask.png', { type: decoded.mime });
};
export const prepareOpenAIImageEditInput = async (args) => {
    const imageArray = Array.isArray(args.sourceImages) ? args.sourceImages : [args.sourceImages];
    const [imageFiles, maskFile] = await Promise.all([
        Promise.all(imageArray.map(async (source, index) => await prepareSourceFile(source, index, args.signal))),
        prepareMaskFile(args.mask),
    ]);
    const editParams = {
        model: args.model,
        prompt: args.prompt,
        image: imageFiles,
        n: args.numberOfImages,
        background: args.background,
        quality: args.quality,
        size: args.size,
        moderation: 'low',
        output_format: 'png',
        ...(args.inputFidelity ? { input_fidelity: args.inputFidelity } : {}),
        ...(maskFile ? { mask: maskFile } : {}),
    };
    const uploadMetadata = (file) => ({
        filename: file.name,
        content_type: file.type,
        byte_count: file.size,
    });
    const requestLogData = {
        model: args.model,
        prompt: args.prompt,
        n: args.numberOfImages,
        background: args.background,
        quality: args.quality,
        size: args.size,
        moderation: 'low',
        output_format: 'png',
        ...(args.inputFidelity ? { input_fidelity: args.inputFidelity } : {}),
        source_images: imageFiles.map(uploadMetadata),
        ...(maskFile ? { mask: uploadMetadata(maskFile) } : {}),
    };
    return { editParams, requestLogData };
};
