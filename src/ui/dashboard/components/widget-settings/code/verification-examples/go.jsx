import { PHP_METADATA_JSON_EXAMPLE } from '../metadataExample';
import { metadataContractComment } from '../verificationContract';

function buildGoIdentityExample() {
    return [
        'package main',
        '',
        'import (',
        '    "crypto/hmac"',
        '    "crypto/sha256"',
        '    "encoding/hex"',
        '    "os"',
        ')',
        '',
        'func sign(secret, value string) string {',
        '    mac := hmac.New(sha256.New, []byte(secret))',
        '    _, _ = mac.Write([]byte(value))',
        '    return hex.EncodeToString(mac.Sum(nil))',
        '}',
        '',
        'func main() {',
        '    secret := os.Getenv("H2H_SECRET")',
        '    if secret == "" { panic("set H2H_SECRET on this server") }',
        '    userID, email := "user-123", "person@example.test"',
        '    identifier := userID',
        '    if identifier == "" { identifier = email }',
        '    if identifier == "" { panic("a stable user id or email is required") }',
        '    contact := map[string]interface{}{"identifier": identifier, "hash": sign(secret, identifier)}',
        '    _ = contact // Add this to the widget init configuration.',
        '}',
    ].join('\n');
}

function buildGoMetadataExample() {
    return [
        '// Add "encoding/json" to the imports above.',
        '// Optional: place inside main, after contact is created; it uses H2H_SECRET through secret.',
        ...metadataContractComment('//').split('\n'),
        `phpMetadataJSON := \`${PHP_METADATA_JSON_EXAMPLE}\``,
        'var metadata map[string]interface{}',
        'if err := json.Unmarshal([]byte(phpMetadataJSON), &metadata); err != nil { panic(err) }',
        'metadata["hash"] = sign(secret, phpMetadataJSON)',
        'contact["metadata"] = metadata',
    ].join('\n');
}

export {
    buildGoIdentityExample,
    buildGoMetadataExample,
};
