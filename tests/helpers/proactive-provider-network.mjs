import assert from 'node:assert/strict';

/** Provider protocol fixtures only; application state and jobs run in the real Worker. */
export default async request => {
    const url = new URL(request.url);
    if (url.hostname === 'api.apify.com') {
        if (request.method === 'POST') {
            const body = await request.json();
            assert.ok(body.startUrls[0].url.startsWith('https://support.example.test'));
            assert.ok(body.maxCrawlPages > 0);
            return Response.json({data: {id: 'fixture-crawl', defaultDatasetId: 'fixture-corpus'}});
        }
        if (url.pathname.includes('/actor-runs/')) return Response.json({data: {status: 'SUCCEEDED', defaultDatasetId: 'fixture-corpus'}});
        if (url.pathname.includes('/datasets/')) return Response.json([{url: 'https://support.example.test/api-credentials', title: 'Connect your workspace', text: 'Create an API credential under Workspace settings, then API credentials. Copy the credential into your integration and check the connection.'}]);
    }
    assert.equal(url.hostname, 'api.openai.com', 'unexpected provider request');
    const body = await request.json(), name = body.text?.format?.name;
    const evidence = JSON.stringify(body).match(/action:[a-z0-9-]+/)?.[0];
    const result = name === 'context_analysis'
        ? {decision: 'insight', help_type: 'support', evidence_ids: [evidence], help: 'Help finding an API credential after unsuccessful connection attempts'}
        : name === 'context_insight'
            ? {content: 'Having trouble connecting your workspace? I can help you find your API credential.', buttons: [{text: 'Show me where', action: 'send'}, {text: 'No thanks', action: 'close'}], loading: null, evidence_ids: [evidence]}
            : name === 'context_summary'
                ? {summary: 'The visitor checked workspace settings and retried an unsuccessful API connection.'}
                : null;
    const text = result ? JSON.stringify(result) : 'Open Workspace settings, choose API credentials, and create a credential. Copy it into your integration, then check the connection again.';
    const events = [{type: 'response.output_text.delta', item_id: 'msg', delta: text}, {type: 'response.output_text.done', item_id: 'msg', text}, {type: 'response.completed', response: {usage: {input_tokens: 20, output_tokens: 12, total_tokens: 32, input_tokens_details: {cached_tokens: 0, cache_write_tokens: 0}, output_tokens_details: {reasoning_tokens: 0}}}}];
    return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), {headers: {'content-type': 'text/event-stream'}});
};
