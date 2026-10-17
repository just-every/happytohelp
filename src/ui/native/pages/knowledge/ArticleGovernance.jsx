import React, { useState } from 'react';
import ArticleTranslations from './ArticleTranslations';
import ArticleHistory from './ArticleHistory';

export default function ArticleGovernance({ projectId, article, onRollback }) {
    const [visited, setVisited] = useState({});
    return <div className="knowledge-article-governance">
        <details onToggle={event => { if (event.currentTarget.open) setVisited(value => ({...value, translations: true})); }}>
            <summary>Translations</summary>
            {visited.translations && <ArticleTranslations projectId={projectId} articleId={article.id}/>}
        </details>
        <details onToggle={event => { if (event.currentTarget.open) setVisited(value => ({...value, history: true})); }}>
            <summary>Version history and redirects</summary>
            {visited.history && <ArticleHistory projectId={projectId} article={article} onRollback={onRollback}/>}
        </details>
    </div>;
}
