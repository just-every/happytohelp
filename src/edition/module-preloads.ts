import graph from 'virtual:happytohelp-module-preloads';

const attribute = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Expand only the selected signed-in route's existing preload seeds. Dynamic
 * imports stay lazy, and HTML keeps streaming while the head is rewritten. */
export function withWorkspaceModulePreloads(request: Request, response: Response): Response {
    if (import.meta.env.DEV || request.method !== 'GET' || response.status !== 200
        || !/^\/(?:projects|conversations)(?:\/|$)/.test(new URL(request.url).pathname)
        || !/^text\/html(?:;|$)/i.test(response.headers.get('Content-Type') || '')) return response;

    const seen = new Set<string>();
    return new HTMLRewriter().on('head link[rel="modulepreload"]', {
        element(element) {
            const href = element.getAttribute('href');
            if (!href || !Object.hasOwn(graph, href)) return;
            const crossOrigin = element.getAttribute('crossorigin');
            const nonce = element.getAttribute('nonce');
            const key = (url: string) => JSON.stringify([url, crossOrigin, nonce]);
            if (seen.has(key(href))) { element.remove(); return; }
            seen.add(key(href));
            const attributes = (crossOrigin === null ? '' : ` crossorigin="${attribute(crossOrigin)}"`)
                + (nonce === null ? '' : ` nonce="${attribute(nonce)}"`);
            const links = graph[href].filter(url => {
                if (seen.has(key(url))) return false;
                seen.add(key(url));
                return true;
            }).map(url => `<link rel="modulepreload" href="${attribute(url)}"${attributes}>`).join('');
            if (links) element.after(links, { html: true });
        },
    }).transform(response);
}
