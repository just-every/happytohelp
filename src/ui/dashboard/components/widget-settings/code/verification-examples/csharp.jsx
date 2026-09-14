import { PHP_METADATA_JSON_EXAMPLE, csharpVerbatimString } from '../metadataExample';
import { metadataContractComment } from '../verificationContract';

function buildCsharpIdentityExample() {
    return [
        '// .NET 6+',
        'using System;',
        'using System.Security.Cryptography;',
        'using System.Text;',
        'using System.Text.Json.Nodes;',
        '',
        'var secret = Environment.GetEnvironmentVariable("H2H_SECRET");',
        'if (String.IsNullOrEmpty(secret))',
        '    throw new InvalidOperationException("Set H2H_SECRET on this server.");',
        '',
        'string? userId = "user-123"; // Use a stable server-side id; otherwise use email.',
        'string? email = "person@example.test";',
        'var identifier = userId ?? email ?? throw new ArgumentException("A user id or email is required.");',
        'if (String.IsNullOrEmpty(identifier)) throw new ArgumentException("A user id or email is required.");',
        'using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));',
        'var hash = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(identifier))).ToLowerInvariant();',
        'var contact = new JsonObject { ["identifier"] = identifier, ["hash"] = hash };',
        '',
        '// Add contact to the widget init configuration.',
    ].join('\n');
}

function buildCsharpMetadataExample() {
    return [
        '// Optional: add this after the identity snippet, which reads H2H_SECRET. Add a new HMACSHA256 for each value.',
        ...metadataContractComment('//').split('\n'),
        `var phpMetadataJson = ${csharpVerbatimString(PHP_METADATA_JSON_EXAMPLE)};`,
        'var metadata = JsonNode.Parse(phpMetadataJson)?.AsObject()',
        '    ?? throw new ArgumentException("Metadata must be a JSON object.");',
        'using var metadataHmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));',
        'metadata["hash"] = Convert.ToHexString(metadataHmac.ComputeHash(Encoding.UTF8.GetBytes(phpMetadataJson))).ToLowerInvariant();',
        'contact["metadata"] = metadata;',
    ].join('\n');
}

export {
    buildCsharpIdentityExample,
    buildCsharpMetadataExample,
};
