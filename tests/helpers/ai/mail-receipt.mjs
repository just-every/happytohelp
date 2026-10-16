import assert from 'node:assert/strict'

// QA mailbox JSON, not provider send acceptance or unparsed response text.
export function authenticatedReplyReceipt(body, reply) {
 assert.ok(body && Array.isArray(body.receipts), 'Mailbox response must contain receipts')
 assert.ok(typeof reply === 'string' && reply.length > 0, 'Expected reply is required')
 return body.receipts.find(receipt =>
  typeof receipt?.excerpt === 'string' && receipt.excerpt.split(/\r?\n/).some(line =>
   line.replace(/^\S+ (?:owner|admin|operator): /, '') === reply) &&
  receipt.auth?.dmarc === 'pass')
}
