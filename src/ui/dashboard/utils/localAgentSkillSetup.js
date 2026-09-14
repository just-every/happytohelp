const setupDocumentUrl = (origin, projectId) => `${ origin }/local-agent/setup/${ projectId }.md`;

const setupPrompt = (origin, projectId) => (
    `Connect this Codex task to my HappyToHelp account and wait for support assignments. Follow the setup guide at ${ setupDocumentUrl(origin, projectId) }.`
);

export { setupDocumentUrl, setupPrompt };
