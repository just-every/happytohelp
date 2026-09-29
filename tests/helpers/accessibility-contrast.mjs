import {inflateSync} from 'node:zlib';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function decodePng(buffer) {
    if (!Buffer.from(buffer).subarray(0, 8).equals(pngSignature)) throw new Error('Accessibility contrast screenshot is not a PNG');
    let width;
    let height;
    let bitDepth;
    let colorType;
    let interlace;
    const compressed = [];
    for (let offset = 8; offset < buffer.length;) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
            interlace = data[12];
        } else if (type === 'IDAT') {
            compressed.push(data);
        } else if (type === 'IEND') {
            break;
        }
        offset += length + 12;
    }
    const channels = ({0: 1, 2: 3, 4: 2, 6: 4})[colorType];
    if (bitDepth !== 8 || !channels || interlace !== 0) {
        throw new Error(`Unsupported Chromium PNG format: bit depth ${bitDepth}, color type ${colorType}, interlace ${interlace}`);
    }
    const bytesPerPixel = channels;
    const stride = width * bytesPerPixel;
    const raw = inflateSync(Buffer.concat(compressed));
    const decoded = new Uint8Array(height * stride);
    const paeth = (a, b, c) => {
        const prediction = a + b - c;
        const distanceA = Math.abs(prediction - a);
        const distanceB = Math.abs(prediction - b);
        const distanceC = Math.abs(prediction - c);
        return distanceA <= distanceB && distanceA <= distanceC ? a : distanceB <= distanceC ? b : c;
    };
    for (let y = 0; y < height; y++) {
        const rowOffset = y * (stride + 1);
        const filter = raw[rowOffset];
        const decodedOffset = y * stride;
        for (let x = 0; x < stride; x++) {
            const source = raw[rowOffset + 1 + x];
            const left = x >= bytesPerPixel ? decoded[decodedOffset + x - bytesPerPixel] : 0;
            const above = y > 0 ? decoded[decodedOffset + x - stride] : 0;
            const upperLeft = y > 0 && x >= bytesPerPixel ? decoded[decodedOffset + x - stride - bytesPerPixel] : 0;
            let predictor = 0;
            if (filter === 1) predictor = left;
            else if (filter === 2) predictor = above;
            else if (filter === 3) predictor = Math.floor((left + above) / 2);
            else if (filter === 4) predictor = paeth(left, above, upperLeft);
            else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
            decoded[decodedOffset + x] = (source + predictor) & 0xff;
        }
    }
    const pixels = new Uint8Array(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel++) {
        const source = pixel * channels;
        const target = pixel * 4;
        if (colorType === 0) {
            pixels[target] = pixels[target + 1] = pixels[target + 2] = decoded[source];
            pixels[target + 3] = 255;
        } else if (colorType === 2) {
            pixels[target] = decoded[source];
            pixels[target + 1] = decoded[source + 1];
            pixels[target + 2] = decoded[source + 2];
            pixels[target + 3] = 255;
        } else if (colorType === 4) {
            pixels[target] = pixels[target + 1] = pixels[target + 2] = decoded[source];
            pixels[target + 3] = decoded[source + 1];
        } else {
            pixels.set(decoded.subarray(source, source + 4), target);
        }
    }
    return {width, height, pixels};
}

export function parseCssColor(color) {
    if (typeof color !== 'string') return null;
    const value = color.trim();
    if (value === 'transparent') return [0, 0, 0, 0];
    const srgb = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i);
    if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
    const hex = value.match(/^#([\da-f]{3,8})$/i)?.[1];
    if (hex) {
        const expanded = hex.length <= 4 ? [...hex].map(channel => channel + channel).join('') : hex;
        const channels = expanded.match(/[\da-f]{2}/gi)?.map(channel => Number.parseInt(channel, 16)) || [];
        return channels.length >= 3 ? [channels[0], channels[1], channels[2], channels.length > 3 ? channels[3] / 255 : 1] : null;
    }
    const channels = value.match(/[-\d.]+/g)?.map(Number) || [];
    if (channels.length < 3) return null;
    return [channels[0], channels[1], channels[2], channels.length > 3 ? channels[3] : 1];
}

const luminance = color => color.slice(0, 3)
    .map(channel => channel / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

export function svgBackgroundStrokeColor(backgroundImage) {
    const source = decodeURIComponent(backgroundImage || '');
    const stroke = source.match(/stroke\s*=\s*['"]?#?([\da-f]{3,8})/i)?.[1];
    return stroke ? `#${stroke}` : null;
}

export function contrastRatio(foregroundColor, backgroundColor) {
    const foreground = parseCssColor(foregroundColor);
    const background = parseCssColor(backgroundColor);
    if (!foreground || !background) return null;
    const compositeForeground = foreground.slice(0, 3).map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]));
    const foregroundLuminance = luminance(compositeForeground);
    const backgroundLuminance = luminance(background);
    return Number(((Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)).toFixed(2));
}

export function measureContrastInRegions(image, fragments, elementSize) {
    const scaleX = image.width / elementSize.width;
    const scaleY = image.height / elementSize.height;
    let minimum = Infinity;
    let lowestBackground = null;
    let sampledPixels = 0;
    const fragmentResults = [];
    for (const fragment of fragments) {
        const foreground = parseCssColor(fragment.foreground);
        if (!foreground) continue;
        const opacity = Math.max(0, Math.min(1, Number(fragment.opacity ?? 1)));
        const text = [...foreground.slice(0, 3), foreground[3] * opacity];
        let fragmentMinimum = Infinity;
        let fragmentSamples = 0;
        for (const rect of fragment.rects) {
            const left = Math.max(0, Math.floor(rect.x * scaleX));
            const top = Math.max(0, Math.floor(rect.y * scaleY));
            const right = Math.min(image.width, Math.ceil((rect.x + rect.width) * scaleX));
            const bottom = Math.min(image.height, Math.ceil((rect.y + rect.height) * scaleY));
            for (let y = top; y < bottom; y++) {
                for (let x = left; x < right; x++) {
                    const offset = (y * image.width + x) * 4;
                    const background = [image.pixels[offset], image.pixels[offset + 1], image.pixels[offset + 2]];
                    const foregroundRgb = text.slice(0, 3).map((channel, index) => channel * text[3] + background[index] * (1 - text[3]));
                    const foregroundLuminance = luminance(foregroundRgb);
                    const backgroundLuminance = luminance(background);
                    const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
                    sampledPixels++;
                    fragmentSamples++;
                    fragmentMinimum = Math.min(fragmentMinimum, ratio);
                    if (ratio < minimum) {
                        minimum = ratio;
                        lowestBackground = background;
                    }
                }
            }
        }
        if (fragmentSamples) fragmentResults.push({text: fragment.text.slice(0, 100), foreground: fragment.foreground, fontSize: fragment.fontSize, fontWeight: fragment.fontWeight, sampledPixels: fragmentSamples, minimumContrastRatio: Number(fragmentMinimum.toFixed(2))});
    }
    return {
        sampledPixels,
        minimumContrastRatio: Number.isFinite(minimum) ? Number(minimum.toFixed(2)) : null,
        lowestBackground: lowestBackground?.map(channel => Math.round(channel)) || null,
        fragments: fragmentResults,
    };
}
