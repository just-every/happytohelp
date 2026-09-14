import { PHP_METADATA_JSON_EXAMPLE } from '../metadataExample';
import { metadataContractComment } from '../verificationContract';

function buildNodeIdentityExample() {
    return [
        "import crypto from 'node:crypto';",
        "const secret = process.env.H2H_SECRET;",
        "if (!secret) throw new Error('Set H2H_SECRET on this server.');",
        '',
        "const user = { id: 'user-123', email: 'person@example.test' };",
        'const sourceIdentifier = user.id ?? user.email;',
        "if (sourceIdentifier === null || sourceIdentifier === undefined || sourceIdentifier === '') {",
        "  throw new Error('A stable user id or email is required.');",
        '}',
        'const identifier = String(sourceIdentifier);',
        "const sign = value => crypto.createHmac('sha256', secret).update(value, 'utf8').digest('hex');",
        'const contact = { identifier, hash: sign(identifier) };',
        '',
        '// Add contact to the widget init configuration.',
    ].join('\n');
}

function buildNodeMetadataExample() {
    return [
        '// Optional: append after the identity snippet, which reads H2H_SECRET and defines sign and contact.',
        ...metadataContractComment('//').split('\n'),
        `const phpMetadataJson = '${PHP_METADATA_JSON_EXAMPLE}';`,
        'const metadata = JSON.parse(phpMetadataJson);',
        'metadata.hash = sign(phpMetadataJson);',
        'contact.metadata = metadata;',
    ].join('\n');
}

export {
    buildNodeIdentityExample,
    buildNodeMetadataExample,
};
