/** Only durable server metadata is rendered as a citation. Provisional chunks have no links. */
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
