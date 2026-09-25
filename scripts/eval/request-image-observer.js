'use strict';

const crypto = require('node:crypto');

const digest = value => crypto.createHash('sha256').update(value).digest('hex');

const describeImageUrl = (url, messageIndex, contentIndex) => {
    const dataUrl = url.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/i);
    let decodedBytes = null;
    if (dataUrl) {
        try {
            decodedBytes = Buffer.from(dataUrl[2], 'base64').length;
        } catch {
            decodedBytes = null;
        }
    }

    return {
        transport: 'message_content.image_url',
        message_index: messageIndex,
        content_index: contentIndex,
        url_sha256: digest(url),
        url_length: url.length,
        data_url: Boolean(dataUrl),
        mime_type: dataUrl?.[1] || null,
        decoded_bytes: decodedBytes,
    };
};

const imageInputsForRequestMessages = messages => {
    if (!Array.isArray(messages)) return [];

    return messages.flatMap((message, messageIndex) => {
        if (!Array.isArray(message?.content)) return [];
        return message.content.flatMap((part, contentIndex) => {
            const url = part?.type === 'image_url' ? part?.image_url?.url : null;
            return typeof url === 'string' && url.length > 0
                ? [describeImageUrl(url, messageIndex, contentIndex)]
                : [];
        });
    });
};

module.exports = { imageInputsForRequestMessages };
