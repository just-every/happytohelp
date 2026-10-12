/** Only durable server metadata is rendered as a citation. Provisional chunks have no links. */
const PROVIDER_CITATION_START = '\uE200cite\uE202article:';
const PROVIDER_CITATION_MARKER = /\uE200cite\uE202article:[A-Za-z0-9._:-]+\uE201/g;
const PROVIDER_ARTICLE_ID = /^[A-Za-z0-9._:-]*$/;

/** Remove provider-only article markers from the visible message body. */
export function visibleMessageContent(content) {
 if (typeof content !== 'string') return content ?? '';
 let visible = content.replace(PROVIDER_CITATION_MARKER, '');

 // A streamed answer can end halfway through this marker. Hide that tail until
 // the provider finishes it instead of exposing its private-use glyphs.
 const markerStart = visible.lastIndexOf('\uE200');
 if (markerStart !== -1) {
  const tail = visible.slice(markerStart);
  const partialStart = PROVIDER_CITATION_START.startsWith(tail);
  const partialId = tail.startsWith(PROVIDER_CITATION_START)
   && PROVIDER_ARTICLE_ID.test(tail.slice(PROVIDER_CITATION_START.length));
  if (partialStart || partialId) visible = visible.slice(0, markerStart);
 }

 return visible;
}

export function messageCitations(message) {
 if (!message?.id || message.erased_at || message.chunked && !message.chunked_complete) return [];
 let citations = message.citations;
 if (!Array.isArray(citations)) {
  try { citations = JSON.parse(message.citations_json || '[]'); } catch { return []; }
 }
 if (!Array.isArray(citations)) return [];
 return citations.filter(c => {
  if (!c || !/^(article|knowledge):.+/.test(c.id) || typeof c.title !== 'string' || typeof c.url !== 'string' || /[\u0000-\u0020\u007f]/.test(c.url)) return false;
  try { const url = new URL(c.url); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
 }).slice(0, 10);
}
