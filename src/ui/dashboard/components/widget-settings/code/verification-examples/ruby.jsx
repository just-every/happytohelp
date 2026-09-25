import { PHP_METADATA_JSON_EXAMPLE } from '../metadataExample';
import { metadataContractComment } from '../verificationContract';

function buildRubyIdentityExample() {
    return [
        "require 'openssl'",
        '',
        "secret = ENV.fetch('H2H_SECRET')",
        '',
        "user = { id: 'user-123', email: 'person@example.test' }",
        'source_identifier = user[:id] || user[:email]',
        "raise ArgumentError, 'A stable user id or email is required.' if source_identifier.nil? || source_identifier == ''",
        'identifier = source_identifier.to_s',
        "sign = ->(value) { OpenSSL::HMAC.hexdigest('SHA256', secret, value.encode('UTF-8')) }",
        'contact = { identifier: identifier, hash: sign.call(identifier) }',
        '',
        '# Add contact to the widget init configuration.',
    ].join('\n');
}

function buildRubyMetadataExample() {
    return [
        "require 'json'",
        '',
        '# Optional: append after the identity snippet, which reads H2H_SECRET and defines sign and contact.',
        ...metadataContractComment('#').split('\n'),
        `php_metadata_json = '${PHP_METADATA_JSON_EXAMPLE}'`,
        'metadata = JSON.parse(php_metadata_json)',
        "metadata['hash'] = sign.call(php_metadata_json)",
        'contact[:metadata] = metadata',
    ].join('\n');
}

export {
    buildRubyIdentityExample,
    buildRubyMetadataExample,
};
