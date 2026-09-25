function buildPhpIdentityExample() {
    return [
        '<?php',
        "$secret = getenv('H2H_SECRET');",
        "if ($secret === false || $secret === '') {",
        "    throw new RuntimeException('Set H2H_SECRET on this server.');",
        '}',
        '',
        '// Use a stable server-side user id; email is the fallback.',
        "$user = ['id' => 'user-123', 'email' => 'person@example.test'];",
        "$sourceIdentifier = $user['id'] ?? $user['email'] ?? null;",
        "if ($sourceIdentifier === null || $sourceIdentifier === '') {",
        "    throw new InvalidArgumentException('A stable user id or email is required.');",
        '}',
        '$identifier = (string) $sourceIdentifier;',
        "$contact = ['identifier' => $identifier, 'hash' => hash_hmac('sha256', $identifier, $secret)];",
        '',
        '// Add $contact to the widget init configuration.',
    ].join('\n');
}

function buildPhpMetadataExample() {
    return [
        '// Optional: append inside the identity snippet after $contact is created; it uses H2H_SECRET already read above.',
        ...metadataContractComment('//').split('\n'),
        '$metadata = [',
        "    'plan' => 'Growth',",
        "    'signed_up_at' => '2026-09-01 12:00:00',",
        '];',
        '$metadataJson = json_encode($metadata, JSON_THROW_ON_ERROR);',
        "$metadata['hash'] = hash_hmac('sha256', $metadataJson, $secret);",
        "$contact['metadata'] = $metadata;",
    ].join('\n');
}

export {
    buildPhpIdentityExample,
    buildPhpMetadataExample,
};
import { metadataContractComment } from '../verificationContract';
