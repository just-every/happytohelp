import { escapeHtml as e } from './html'

type ShellOptions = {
 /** Search box value; ignored when `search` is false. */
 keyword?: string
 /** The search form needs a project to search; a page with no known project omits it. */
 search?: boolean
 /** Replaces the default "<project> Help Center" document title. */
 title?: string
 noindex?: boolean
}

/** The Help Center document frame: header, brand, search and content column. `base` is the project's help URL, or `/` when no project is known. */
export function shell(project: { name: string }, base: string, content: string, { keyword = '', search = true, title, noindex = false }: ShellOptions = {}) {
 const searchForm = search ? `<form class="help-center-search" action="${base}/search" role="search"><input type="search" placeholder="Search the Help Center" value="${e(keyword)}" aria-label="Search the Help Center" name="keyword"><button type="submit">Search</button></form>` : ''
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${noindex ? '<meta name="robots" content="noindex">' : ''}<title>${e(title ?? `${project.name} Help Center`)}</title><link rel="stylesheet" href="/site-assets/help_center/css/app.css"></head><body><nav class="help-center-nav" data-help-center-nav aria-label="Help Center navigation"><div class="help-center-nav-inner"><a class="help-center-brand" href="${base}"><strong>${e(project.name)}</strong> Help Center</a>${searchForm}</div></nav><main class="help-center-main"><div class="help-center-content">${content}</div></main></body></html>`
}
