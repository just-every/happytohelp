import { PHP_METADATA_JSON_EXAMPLE } from '../metadataExample';
import { metadataContractComment } from '../verificationContract';

function buildPythonIdentityExample() {
    return [
        'import hashlib',
        'import hmac',
        'import os',
        '',
        "secret = os.environ.get('H2H_SECRET')",
        'if not secret:',
        "    raise RuntimeError('Set H2H_SECRET on this server.')",
        '',
        "user = {'id': 'user-123', 'email': 'person@example.test'}",
        "source_identifier = user.get('id')",
        'if source_identifier is None:',
        "    source_identifier = user.get('email')",
        "if source_identifier is None or source_identifier == '':",
        "    raise ValueError('A stable user id or email is required.')",
        'identifier = str(source_identifier)',
        "sign = lambda value: hmac.new(secret.encode('utf-8'), value.encode('utf-8'), hashlib.sha256).hexdigest()",
        "contact = {'identifier': identifier, 'hash': sign(identifier)}",
        '',
        '# Add contact to the widget init configuration.',
    ].join('\n');
}

function buildPythonMetadataExample() {
    return [
        'import json',
        '',
        '# Optional: append after the identity snippet, which reads H2H_SECRET and defines sign and contact.',
        ...metadataContractComment('#').split('\n'),
        `php_metadata_json = r'${PHP_METADATA_JSON_EXAMPLE}'`,
        'metadata = json.loads(php_metadata_json)',
        "metadata['hash'] = sign(php_metadata_json)",
        "contact['metadata'] = metadata",
    ].join('\n');
}

export {
    buildPythonIdentityExample,
    buildPythonMetadataExample,
};
