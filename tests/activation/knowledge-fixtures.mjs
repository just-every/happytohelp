export const ARTICLE_RETRIEVAL_TOKEN = 'T022ArticleRetrievalMarker';
export const DATASET_RETRIEVAL_TOKEN = 'T022DatasetRetrievalMarker';

export function articleFixture({ title = 'First-run article', status = 'draft', token = ARTICLE_RETRIEVAL_TOKEN } = {}) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
        title,
        slug: slug + '-' + token.toLowerCase(),
        summary: 'A local browser fixture for article editing and publication.',
        content: '# ' + title + '\n\n' + token + ' is unique to this local fixture.\n\nThe source exists only in the isolated browser test.',
        status,
    };
}

export function datasetDocument() {
    return {
        url: 'https://knowledge-fixture.example.test/first-run',
        title: 'First-run website source',
        content: DATASET_RETRIEVAL_TOKEN + ' belongs to the isolated published corpus. It checks real local retrieval.',
    };
}

export function longArticleContent() {
    return Array.from({ length: 100 }, (_, index) => {
        return '## Section ' + (index + 1) + '\n\n' + ARTICLE_RETRIEVAL_TOKEN + ' — ' +
            'This paragraph keeps the editor long enough to inspect its sticky controls while scrolling. '.repeat(2);
    }).join('\n\n');
}
