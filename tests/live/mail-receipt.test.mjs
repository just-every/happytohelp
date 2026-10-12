import test from 'node:test'
import assert from 'node:assert/strict'
import {authenticatedReplyReceipt} from './mail-receipt.mjs'

test('QA mailbox delivery requires the expected reply and DMARC on the same receipt', () => {
 const reply = 'Operator reply conversation-7'
 const delivered = {excerpt: `Transcript\n2026-10-11T12:09:28.768Z owner: ${reply}`, auth: {dmarc: 'pass'}}
 assert.equal(authenticatedReplyReceipt({receipts: [delivered]}, reply), delivered)
 assert.equal(authenticatedReplyReceipt({receipts: [
  {excerpt: reply, auth: {dmarc: 'fail'}},
  {excerpt: 'An unrelated message', auth: {dmarc: 'pass'}},
  {excerpt: reply},
  {excerpt: `2026-10-11T12:09:28.768Z owner: ${reply}0`, auth: {dmarc: 'pass'}},
 ]}, reply), undefined)
 assert.equal(authenticatedReplyReceipt({receipts: []}, reply), undefined)
 assert.throws(() => authenticatedReplyReceipt({accepted: true}, reply))
})
