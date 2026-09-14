'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CHAT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_FIXTURE_PATH = path.join(CHAT_ROOT, 'tests', 'training', 'fixtures', 'eval-cases.v1.json');

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const resolveAttachmentAssets = (fixture, fixturePath) => {
    const resolved = JSON.parse(JSON.stringify(fixture));
    for (const item of resolved.cases || []) {
        for (const attachment of item.attachments || []) {
            if (!attachment.asset_base64_path) continue;
            const assetPath = path.resolve(path.dirname(fixturePath), attachment.asset_base64_path);
            const base64 = fs.readFileSync(assetPath, 'utf8').replace(/\s+/g, '');
            if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
                throw new Error(`Attachment asset is not base64: ${assetPath}`);
            }
            if (attachment.mime_type === 'image/png' && !Buffer.from(base64, 'base64').subarray(0, 8).equals(PNG_SIGNATURE)) {
                throw new Error(`PNG attachment asset has an invalid signature: ${assetPath}`);
            }
            attachment.data_url = `data:${attachment.mime_type};base64,${base64}`;
        }
    }
    return resolved;
};

const attachmentDigest = (fixture, fixturePath) => (fixture.cases || [])
    .flatMap(item => item.attachments || [])
    .filter(attachment => attachment.asset_base64_path)
    .map(attachment => fs.readFileSync(path.resolve(path.dirname(fixturePath), attachment.asset_base64_path)));

const loadFixture = (fixturePath = process.env.SUGGESTIONS_EVAL_FIXTURE || DEFAULT_FIXTURE_PATH) => {
    const absolutePath = path.resolve(fixturePath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
        path: absolutePath,
        digest: digest(Buffer.concat([Buffer.from(raw), ...attachmentDigest(parsed, absolutePath)])),
        value: resolveAttachmentAssets(parsed, absolutePath),
    };
};

const validateFixture = (fixture) => {
    const failures = [];
    if (!fixture || typeof fixture !== 'object') {
        return ['fixture must be an object'];
    }
    if (fixture.schema_version !== 'happytohelp.synthetic-eval.v1') {
        failures.push('unexpected schema_version');
    }
    if (fixture.namespace !== 'happytohelp.synthetic-eval.v1') {
        failures.push('unexpected namespace');
    }
    if (!Array.isArray(fixture.cases) || fixture.cases.length !== 16) {
        failures.push('fixture must define exactly 16 evaluation cases');
    }

    const seenIds = new Set();
    for (const item of fixture.cases || []) {
        if (!item?.id || !/^[a-z0-9_]+$/.test(item.id)) {
            failures.push(`invalid case id '${item?.id || ''}'`);
            continue;
        }
        if (seenIds.has(item.id)) {
            failures.push(`duplicate case id '${item.id}'`);
        }
        seenIds.add(item.id);
        if (!item.contact?.email?.endsWith('@example.test')) {
            failures.push(`${item.id}: contact email must use example.test`);
        }
        if (!Array.isArray(item.messages) || item.messages.length === 0) {
            failures.push(`${item.id}: at least one message is required`);
        }
        if (!item.request || typeof item.request !== 'object') {
            failures.push(`${item.id}: request is required`);
        }
        if (!item.expected || typeof item.expected !== 'object') {
            failures.push(`${item.id}: expected checks are required`);
        }
    }

    const readyCount = Number(fixture.corpus?.filler_ready_count || 0) + (fixture.corpus?.ready_documents?.length || 0);
    if (readyCount <= 130) {
        failures.push('corpus must have more than 130 ready documents');
    }
    if (!fixture.corpus?.ready_documents?.some((document) => document.id === 'beyond-window-policy' && document.legacy_window_position > 130)) {
        failures.push('corpus must include the beyond-window policy after the legacy 130-file retrieval window');
    }
    if (!fixture.corpus?.draft_documents?.some((document) => document.id === 'returns-policy-draft')) {
        failures.push('corpus must include a draft-only returns policy');
    }
    if (!fixture.restricted_workspace?.document?.id) {
        failures.push('fixture must include an inaccessible restricted-workspace document');
    }
    const imageAttachment = fixture.cases?.find(item => item.id === 'attachment_image_damage')?.attachments?.[0];
    if (imageAttachment?.mime_type !== 'image/png' || !String(imageAttachment?.data_url || '').startsWith('data:image/png;base64,')) {
        failures.push('attachment case must include a native PNG data URL');
    }
    return failures;
};

module.exports = {
    CHAT_ROOT,
    DEFAULT_FIXTURE_PATH,
    digest,
    loadFixture,
    resolveAttachmentAssets,
    validateFixture,
};
