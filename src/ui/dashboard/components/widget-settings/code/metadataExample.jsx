const PHP_METADATA_JSON_EXAMPLE = '{"plan":"Growth","signed_up_at":"2026-09-01 12:00:00"}';

function csharpVerbatimString(value) {
    return `@"${value.replace(/"/g, '""')}"`;
}

export {
    PHP_METADATA_JSON_EXAMPLE,
    csharpVerbatimString,
};
