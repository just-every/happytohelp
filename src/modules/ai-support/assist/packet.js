

const MAX_PROVIDER_IMAGES = 4;

const imageInputsForPacket = packet => (packet?.timeline || [])
    .flatMap(item => item?.attachments || [])
    .filter(attachment => attachment?.content_access === 'included-as-image' && attachment.provider_image_url)
    .filter((attachment, index, attachments) => attachments.findIndex(candidate => candidate.evidence_id === attachment.evidence_id) === index)
    .slice(0, MAX_PROVIDER_IMAGES)
    .map(attachment => ({
        evidence_id: attachment.evidence_id,
        url: attachment.provider_image_url,
    }));

const packetForMessage = (packet, imageInputs) => {
    const includedImageIds = new Set(imageInputs.map(image => image.evidence_id));
    return {
        ...packet,
        timeline: (packet?.timeline || []).map(item => ({
            ...item,
            attachments: (item?.attachments || []).map(attachment => (
                attachment?.content_access === 'included-as-image'
                && !includedImageIds.has(attachment.evidence_id)
                    ? {
                        ...attachment,
                        content_access: 'unavailable',
                        unavailable_reason: 'image-input-budget-exhausted',
                    }
                    : attachment
            )),
        })),
    };
};

const assistPacketMessageContent = packet => {
    const imageInputs = imageInputsForPacket(packet);
    const messagePacket = packetForMessage(packet, imageInputs);
    const parts = [{
        type: 'text',
        text: `Conversation evidence and unsent draft:\n${JSON.stringify(messagePacket, (key, value) => (
            key === 'provider_image_url'
            || ((key === 'url' || key === 'preview_url') && typeof value === 'string' && /^data:/i.test(value))
                ? undefined
                : value
        ))}`,
    }];

    for (const image of imageInputs) {
        parts.push({
            type: 'text',
            text: `The next image is attachment evidence ${image.evidence_id}.`,
        });
        parts.push({ type: 'image_url', image_url: { url: image.url } });
    }

    return parts.length === 1 ? parts[0].text : parts;
};

const addEvidenceId = (target, item) => {
    if (item?.evidence_id) target.add(item.evidence_id);
    for (const attachment of item?.attachments || []) {
        if (attachment?.evidence_id) target.add(attachment.evidence_id);
    }
};

const evidenceIdsForPacket = packet => {
    const evidenceIds = new Set();
    addEvidenceId(evidenceIds, packet?.company);
    addEvidenceId(evidenceIds, packet?.customer);
    for (const item of packet?.timeline || []) addEvidenceId(evidenceIds, item);
    for (const item of packet?.private_notes || []) addEvidenceId(evidenceIds, item);
    for (const item of packet?.activity || []) addEvidenceId(evidenceIds, item);
    for (const item of packet?.summaries || []) addEvidenceId(evidenceIds, item);
    for (const item of packet?.knowledge?.catalog || []) addEvidenceId(evidenceIds, item);
    return evidenceIds;
};

const validateEvidenceIds = (output, issuedEvidenceIds) => {
    if (!(issuedEvidenceIds instanceof Set)) {
        throw new TypeError('Assist output validation requires the issued evidence ID set.');
    }

    for (const response of output?.responses || []) {
        if (!Array.isArray(response?.evidence_ids)) {
            throw new TypeError('Every assist response must include an evidence_ids array.');
        }

        const unknown = response.evidence_ids.filter(id => typeof id !== 'string' || !issuedEvidenceIds.has(id));
        if (unknown.length > 0) {
            throw new Error(`Assist output referenced unknown evidence IDs: ${unknown.join(', ')}`);
        }
    }

    return output;
};

export {
    MAX_PROVIDER_IMAGES,
    assistPacketMessageContent,
    evidenceIdsForPacket,
    imageInputsForPacket,
    packetForMessage,
    validateEvidenceIds,
};
