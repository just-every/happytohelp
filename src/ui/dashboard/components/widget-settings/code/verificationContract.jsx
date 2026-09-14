const VERIFICATION_SECRET_ENVIRONMENT_VARIABLE = 'H2H_SECRET';

const PHP_METADATA_ENCODING_REQUIREMENT = [
    'The Laravel endpoint removes metadata.hash, then validates HMAC-SHA256 against PHP json_encode(metadata).',
    'Sign the exact UTF-8 bytes returned by PHP json_encode(metadata without metadata.hash).',
    'PHP uses its default escaping: Unicode and / are escaped, key order is retained, and no keys are sorted.',
    'In another runtime, sign an already PHP-encoded JSON string before parsing it only to add metadata.hash.',
].join(' ');

function metadataContractComment(comment) {
    return PHP_METADATA_ENCODING_REQUIREMENT.split(' ').reduce((lines, word) => {
        const line = lines.at(-1);
        if (`${line} ${word}`.length > 92) lines.push(`${comment} ${word}`);
        else lines[lines.length - 1] = `${line} ${word}`;
        return lines;
    }, [comment]).join('\n');
}

export {
    PHP_METADATA_ENCODING_REQUIREMENT,
    VERIFICATION_SECRET_ENVIRONMENT_VARIABLE,
    metadataContractComment,
};
