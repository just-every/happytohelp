import { normalisePublicConfig } from './publicConfig';
import {
    buildCsharpIdentityExample,
    buildCsharpMetadataExample,
} from './verification-examples/csharp';
import {
    buildGoIdentityExample,
    buildGoMetadataExample,
} from './verification-examples/go';
import {
    buildNodeIdentityExample,
    buildNodeMetadataExample,
} from './verification-examples/node';
import {
    buildPhpIdentityExample,
    buildPhpMetadataExample,
} from './verification-examples/php';
import {
    buildPythonIdentityExample,
    buildPythonMetadataExample,
} from './verification-examples/python';
import {
    buildRubyIdentityExample,
    buildRubyMetadataExample,
} from './verification-examples/ruby';

const VERIFICATION_LANGUAGES = Object.freeze([
    { id: 'php', label: 'PHP' },
    { id: 'node', label: 'Node.js' },
    { id: 'python', label: 'Python' },
    { id: 'ruby', label: 'Ruby' },
    { id: 'go', label: 'Go' },
    { id: 'csharp', label: 'C#' },
]);

const exampleBuilders = {
    php: { identity: buildPhpIdentityExample, metadata: buildPhpMetadataExample },
    node: { identity: buildNodeIdentityExample, metadata: buildNodeMetadataExample },
    python: { identity: buildPythonIdentityExample, metadata: buildPythonMetadataExample },
    ruby: { identity: buildRubyIdentityExample, metadata: buildRubyMetadataExample },
    go: { identity: buildGoIdentityExample, metadata: buildGoMetadataExample },
    csharp: { identity: buildCsharpIdentityExample, metadata: buildCsharpMetadataExample },
};

function buildExamples(publicConfig, language = 'php') {
    const config = normalisePublicConfig(publicConfig);
    if (typeof language !== 'string' || !exampleBuilders[language]) {
        throw new RangeError(`Unsupported verification language: ${language}`);
    }

    const builder = exampleBuilders[language];
    return {
        identityCode: builder.identity(config),
        metadataCode: builder.metadata(config),
    };
}

function buildVerificationExample(publicConfig, language = 'php') {
    return buildExamples(publicConfig, language).identityCode;
}

function buildMetadataExample(publicConfig, language = 'php') {
    return buildExamples(publicConfig, language).metadataCode;
}

function buildVerificationExamples(publicConfig, language = 'php') {
    return buildExamples(publicConfig, language);
}

export {
    VERIFICATION_LANGUAGES,
    buildMetadataExample,
    buildVerificationExample,
    buildVerificationExamples,
};
