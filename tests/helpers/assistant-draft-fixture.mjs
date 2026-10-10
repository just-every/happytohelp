import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function assistantDraftFixture(runtime, context, session, tenant, width) {
    const {origin} = runtime, {projectId} = tenant;
    const post = async (path, data, token) => {
        const response = await context.request.post(origin + path, {data, ...(token ? {headers:{Authorization:'Bearer ' + token}} : {})});
        assert.equal(response.status(), 200, await response.text());
        return (await response.json()).data;
    };
    const pairing = await post(`/api/projects/${projectId}/local-agents/pairings`, {});
    const paired = await post('/api/local-agents/pair', {code:pairing.code, name:'Draft handoff test', provider:'codex', capabilities:[]});
    const job = await post(`/api/projects/${projectId}/conversations/${session.conversationId}/delegations`, {
        device_id:paired.device.id, mode:'resolve', instructions:'Test-only completed result; no provider execution.', request_id:randomUUID(),
    });
    const claim = await post('/api/local-agents/claim', {claim_id:randomUUID()}, paired.token);
    assert.equal(claim.id, job.id);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=', 'base64');
    const upload = await context.request.post(origin + `/api/local-agents/jobs/${job.id}/attachments`, {
        headers:{Authorization:'Bearer ' + paired.token},
        multipart:{run_id:claim.run_id, file:{name:'handoff.png', mimeType:'image/png', buffer:png}},
    });
    assert.equal(upload.status(), 200, await upload.text());
    const attachment = (await upload.json()).data;
    const body = `Reviewed draft for ${width}: ${randomUUID()}.`;
    const legacy = `Legacy editable draft for ${width}.`;
    const result = await post(`/api/local-agents/jobs/${job.id}/result`, {
        run_id:claim.run_id, event_id:randomUUID(), status:'completed', result:{
            summary:'Completed fixture for handoff browser coverage.', actions:[], verified:true,
            reply_draft:legacy, attachment_ids:[attachment.id],
            replies:[{id:'main', title:'Reviewed reply', body, attachment_ids:[]},
                {id:'attachment', title:'Reply with screenshot', body:'Screenshot draft.', attachment_ids:[attachment.id]}],
            follow_up_actions:[],
        },
    }, paired.token);
    assert.equal(result.status, 'completed');
    return {body, legacy, attachment, jobId:job.id};
}

export async function visitorConversation({browser, origin, widgetKey, projectId, viewport}) {
    const context = await browser.newContext({viewport}), page = await context.newPage(), frames = [];
    page.on('websocket', socket => socket.on('framereceived', event => {
        try { frames.push(JSON.parse(event.payload)); } catch {}
    }));
    const mount = async () => {
        await page.addScriptTag({url:origin + '/widget.js'});
        await page.evaluate(options => window.h2h('init', options), {
            widgetKey, apiOrigin:origin, open:true, settings:{collector:{enabled:false}},
        });
    };
    try {
        await page.goto(origin + `/help/${projectId}`);
        await mount();
        await page.locator('textarea[name=content]').fill('Please review this customer request.');
        await page.locator('button[name=submit]').click();
        const storageKey = `rer-widget:${origin}:${widgetKey}`;
        await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.conversationId, storageKey);
        const session = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
        const transcript = async () => {
            const response = await context.request.get(origin + `/api/conversations/${session.conversationId}/messages`, {
                headers:{Authorization:'Bearer ' + session.token},
            });
            assert.equal(response.status(), 200);
            return (await response.json()).messages;
        };
        return {context, page, frames, mount, session, transcript};
    } catch (error) { await context.close(); throw error; }
}
