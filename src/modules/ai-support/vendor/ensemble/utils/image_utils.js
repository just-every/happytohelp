import { Buffer } from 'node:buffer';
import { v4 as uuidv4 } from 'uuid';
import { detectImageType, isValidBase64 } from './image_validation.js';
import { convertImageToTextIfNeeded } from './image_to_text.js';
export async function appendMessageWithImage(model, input, message, param, addImagesToInput, source) {
    const content = typeof param === 'string'
        ? typeof message[param] === 'string'
            ? message[param]
            : JSON.stringify(message[param])
        : param.read();
    const extracted = extractBase64Image(content);
    if (!extracted.found) {
        input.push(message);
        return input;
    }
    let imagesConverted = false;
    for (const [image_id, imageData] of Object.entries(extracted.images)) {
        const imageToText = await convertImageToTextIfNeeded(imageData, model);
        if (imageToText && typeof imageToText === 'string') {
            extracted.replaceContent.replaceAll(`[image #${image_id}]`, `[image #${image_id}: ${imageToText}]`);
            imagesConverted = true;
        }
    }
    if (typeof param === 'string') {
        const newMessage = { ...message };
        newMessage[param] = extracted.replaceContent;
        input.push(newMessage);
    }
    else {
        input.push(param.write(extracted.replaceContent));
    }
    if (!imagesConverted) {
        input = await addImagesToInput(input, extracted.images, source || `${message.role} message`);
    }
    return input;
}
function normalizeExplicitImageId(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const normalized = trimmed.replace(/[^A-Za-z0-9._:-]+/g, '');
    if (!normalized)
        return null;
    return normalized.slice(0, 128);
}
function resolveImagePlaceholderId(explicitIdRaw, images, imageDataUrl) {
    const explicitId = explicitIdRaw ? normalizeExplicitImageId(explicitIdRaw) : null;
    if (explicitId) {
        const existing = images[explicitId];
        if (!existing || existing === imageDataUrl) {
            return explicitId;
        }
        let suffix = 2;
        while (true) {
            const candidate = `${explicitId}_${suffix}`;
            const existingCandidate = images[candidate];
            if (!existingCandidate || existingCandidate === imageDataUrl) {
                return candidate;
            }
            suffix += 1;
        }
    }
    let generated = uuidv4();
    while (images[generated] && images[generated] !== imageDataUrl) {
        generated = uuidv4();
    }
    return generated;
}
export function extractBase64Image(content) {
    const result = {
        found: false,
        originalContent: content,
        replaceContent: content,
        image_id: null,
        images: {},
    };
    if (typeof content !== 'string')
        return result;
    if (!content.includes('data:') || !content.includes('base64,'))
        return result;
    const imgRegex = /(?:\[image\s*#([A-Za-z0-9._:-]{1,128})\]\s*)?data:(?:image\/)?([a-zA-Z0-9.+-]+);base64,[A-Za-z0-9+/\s]*={0,2}/gi;
    const images = {};
    const replaceContent = content.replace(imgRegex, (match, explicitIdRaw, _mime) => {
        const mimeMatch = match.match(/data:(?:image\/)?([a-zA-Z0-9.+-]+);base64,/);
        const mime = mimeMatch ? mimeMatch[1] : '';
        const base64Start = match.indexOf('base64,') + 7;
        let base64Data = match.substring(base64Start);
        base64Data = base64Data.replace(/\s+/g, '');
        let startBinary = '';
        let endBinary = '';
        if (mime === 'png') {
            startBinary = '\x89PNG\r\n\x1A\n';
            endBinary = '\x00\x00\x00\x00IEND\xAE\x42\x60\x82';
        }
        else if (mime === 'jpeg' || mime === 'jpg') {
            startBinary = '\xFF\xD8\xFF';
            endBinary = '\xFF\xD9';
        }
        else if (mime === 'gif') {
            startBinary = 'GIF87a';
            if (base64Data.startsWith('R0lGODlh') || base64Data.startsWith('R0lGODdh')) {
                startBinary = 'GIF89a';
            }
            endBinary = '\x3B';
        }
        let goodBase64 = base64Data;
        if (startBinary && endBinary) {
            let l = Math.floor(base64Data.length / 4) * 4;
            let found = false;
            while (l >= ((startBinary.length + endBinary.length) * 4) / 3) {
                try {
                    const bin = atob(base64Data.substr(0, l));
                    if (bin.startsWith(startBinary) && bin.endsWith(endBinary)) {
                        goodBase64 = base64Data.substr(0, l);
                        found = true;
                        break;
                    }
                }
                catch {
                }
                l -= 4;
            }
            if (!found) {
                const cleanedMatch = base64Data.match(/^([A-Za-z0-9+/]*)(={0,2})$/);
                if (cleanedMatch) {
                    goodBase64 = cleanedMatch[1] + cleanedMatch[2];
                }
            }
        }
        else {
            const cleanedMatch = base64Data.match(/^([A-Za-z0-9+/]*)(={0,2})$/);
            if (cleanedMatch) {
                goodBase64 = cleanedMatch[1] + cleanedMatch[2];
            }
        }
        const prefix = mime.includes('/') ? 'data:' : 'data:image/';
        const imageDataUrl = `${prefix}${mime};base64,${goodBase64}`;
        const id = resolveImagePlaceholderId(typeof explicitIdRaw === 'string' ? explicitIdRaw : null, images, imageDataUrl);
        images[id] = imageDataUrl;
        return `[image #${id}]`;
    });
    if (Object.keys(images).length === 0) {
        return result;
    }
    const firstImageId = Object.keys(images)[0];
    return {
        found: true,
        originalContent: content,
        replaceContent: replaceContent,
        image_id: firstImageId,
        images: images,
    };
}
function looksLikeBase64(input) {
    const trimmed = input.trim();
    if (trimmed.length < 16)
        return false;
    return /^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmed);
}
function normalizeBase64String(input) {
    const cleaned = input.replace(/\s+/g, '');
    if (!cleaned)
        return '';
    const normalized = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    const mod = normalized.length % 4;
    if (mod === 1)
        return null;
    const padded = normalized + (mod === 0 ? '' : '='.repeat(4 - mod));
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(padded))
        return null;
    try {
        atob(padded);
    }
    catch {
        return null;
    }
    return isValidBase64(padded) ? padded : null;
}
function looksLikeHex(input) {
    const trimmed = input.trim();
    if (trimmed.length < 32 || trimmed.length % 2 !== 0)
        return false;
    return /^[0-9a-fA-F]+$/.test(trimmed);
}
function normalizeHexToBase64(input) {
    if (!looksLikeHex(input))
        return null;
    try {
        return Buffer.from(input.trim(), 'hex').toString('base64');
    }
    catch {
        return null;
    }
}
function getMimeFromMeta(meta) {
    const parts = meta
        .split(';')
        .map(part => part.trim())
        .filter(Boolean);
    const isBase64 = parts.some(part => part.toLowerCase() === 'base64');
    const charset = parts.find(part => part.toLowerCase().startsWith('charset='));
    const mime = parts.find(part => !part.toLowerCase().startsWith('charset=') && part.toLowerCase() !== 'base64');
    return { mime, charset, isBase64 };
}
function appendCharset(mime, charset) {
    return charset ? `${mime};${charset}` : mime;
}
function looksLikeUrl(input) {
    const trimmed = input.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:'))
        return true;
    if (trimmed.startsWith('//'))
        return true;
    if (trimmed.includes(' ') || trimmed.includes('\n'))
        return false;
    if (/^[^\s]+\.[^\s]+\//.test(trimmed))
        return true;
    if (/^[^\s]+\.[^\s]+$/.test(trimmed))
        return true;
    return false;
}
function normalizeBinaryInput(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    return Buffer.from(bytes).toString('base64');
}
export function normalizeImageDataUrl(input) {
    const raw = input.data ?? input.image_url ?? input.url;
    if (!raw)
        return {};
    if (raw instanceof Uint8Array || raw instanceof ArrayBuffer) {
        const base64 = normalizeBinaryInput(raw);
        const mimeType = input.mime_type || detectImageType(base64) || 'image/png';
        return { dataUrl: `data:${mimeType};base64,${base64}` };
    }
    if (typeof raw !== 'string')
        return {};
    const trimmed = raw.trim();
    if (!trimmed)
        return {};
    if (trimmed.startsWith('data:')) {
        const match = trimmed.match(/^data:([^,]*?),(.*)$/s);
        if (!match)
            return { dataUrl: trimmed };
        const meta = match[1] || '';
        const payload = match[2] || '';
        const { mime, charset, isBase64 } = getMimeFromMeta(meta);
        const normalizedBase64 = isBase64 || looksLikeBase64(payload) ? normalizeBase64String(payload) : null;
        if (normalizedBase64) {
            const detected = detectImageType(normalizedBase64);
            const baseMime = mime || input.mime_type || detected || 'image/png';
            const mimeType = appendCharset(baseMime, charset);
            return { dataUrl: `data:${mimeType};base64,${normalizedBase64}` };
        }
        const rawPayload = payload.trim();
        const decoded = (() => {
            try {
                return decodeURIComponent(rawPayload);
            }
            catch {
                return rawPayload;
            }
        })();
        if (decoded) {
            const svgLike = /^<\?xml|<svg/i.test(decoded);
            const baseMime = mime || input.mime_type || (svgLike ? 'image/svg+xml' : 'image/png');
            const mimeType = appendCharset(baseMime, charset);
            const base64 = Buffer.from(decoded, 'utf8').toString('base64');
            return { dataUrl: `data:${mimeType};base64,${base64}` };
        }
        return {};
    }
    if (trimmed.includes(';base64,')) {
        const match = trimmed.match(/^([^,]*?);base64,(.*)$/s);
        if (match) {
            const meta = match[1] || '';
            const payload = match[2] || '';
            const normalizedBase64 = normalizeBase64String(payload);
            if (normalizedBase64) {
                const { mime, charset } = getMimeFromMeta(meta);
                const detected = detectImageType(normalizedBase64);
                const baseMime = mime || input.mime_type || detected || 'image/png';
                const mimeType = appendCharset(baseMime, charset);
                return { dataUrl: `data:${mimeType};base64,${normalizedBase64}` };
            }
        }
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
        return { url: trimmed };
    }
    if (trimmed.startsWith('//')) {
        return { url: `https:${trimmed}` };
    }
    const base64Candidate = normalizeBase64String(trimmed);
    if (base64Candidate) {
        const mimeType = input.mime_type || detectImageType(base64Candidate) || 'image/png';
        return { dataUrl: `data:${mimeType};base64,${base64Candidate}` };
    }
    const hexCandidate = normalizeHexToBase64(trimmed);
    if (hexCandidate) {
        const mimeType = input.mime_type || detectImageType(hexCandidate) || 'image/png';
        return { dataUrl: `data:${mimeType};base64,${hexCandidate}` };
    }
    if (looksLikeUrl(trimmed)) {
        return { url: trimmed.startsWith('http') ? trimmed : `https://${trimmed.replace(/^\/\//, '')}` };
    }
    return {};
}
