import { lazyPageCode } from '../../lazy-page-code';

const editor = lazyPageCode(() => import('../../../dashboard/components/ArticleMarkdownEditor'));
export const ArticleMarkdownEditor = editor.Component;
export const preloadArticleEditor = editor.preload;
