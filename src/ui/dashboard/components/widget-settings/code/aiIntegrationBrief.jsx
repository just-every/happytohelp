import { buildAnonymousEmbedCode } from './anonymousEmbedCode';
import {
    PHP_METADATA_ENCODING_REQUIREMENT,
    VERIFICATION_SECRET_ENVIRONMENT_VARIABLE,
} from './verificationContract';
import { buildVerificationExamples } from './verificationExamples';

const LANGUAGE_FENCES = {
    php: 'php',
    node: 'javascript',
    python: 'python',
    ruby: 'ruby',
    go: 'go',
    csharp: 'csharp',
};

function buildAiIntegrationBrief(publicConfig, language = 'php') {
    const anonymousEmbedCode = buildAnonymousEmbedCode(publicConfig);
    const { identityCode, metadataCode } = buildVerificationExamples(publicConfig, language);
    const fence = LANGUAGE_FENCES[language] || language;

    return [
        '# HappyToHelp widget integration',
        '',
        `Configure \`${VERIFICATION_SECRET_ENVIRONMENT_VARIABLE}\` only in the authenticated application server environment. Never put it in browser code, widget configuration, logs, or a response sent to the browser.`,
        '',
        '## Anonymous widget',
        '',
        'Install this public embed code for visitors who do not need an authenticated contact.',
        '',
        '```html',
        anonymousEmbedCode,
        '```',
        '',
        '## Authenticated contact',
        '',
        'For a signed-in person, run the following on your server. Use a stable user ID when available; otherwise use the email address. Add the resulting public `contact` object to the widget init configuration when rendering the page. The hash may be client-visible; the signing key must remain server-only.',
        '',
        `\`${VERIFICATION_SECRET_ENVIRONMENT_VARIABLE}\` is read from the server environment by this ${language} example.`,
        '',
        `\`\`\`${fence}`,
        identityCode,
        '```',
        '',
        '## Optional signed metadata',
        '',
        'Only include metadata when the authenticated server creates its hash. Sign the metadata without its `hash` field, then add the hash as `metadata.hash`.',
        '',
        PHP_METADATA_ENCODING_REQUIREMENT,
        '',
        `\`\`\`${fence}`,
        metadataCode,
        '```',
    ].join('\n');
}

export { buildAiIntegrationBrief };
