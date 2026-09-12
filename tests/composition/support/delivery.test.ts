import assert from 'node:assert/strict'
import { test } from 'node:test'
const { isDeliveryFact, isFinalDeliveryFailure } = await import(new URL('delivery.ts', process.env.RER_COMPONENT_SOURCE ?? new URL('../src/', import.meta.url)).href)

test('acceptance and delay are observable facts but never final failure or delivery', () => {
  for (const state of ['accepted', 'delayed', 'delivered']) {
    assert.equal(isDeliveryFact(state), true)
    assert.equal(isFinalDeliveryFailure(state), false)
  }
  for (const state of ['bounced', 'rejected', 'failed', 'suppressed']) {
    assert.equal(isDeliveryFact(state), true)
    assert.equal(isFinalDeliveryFailure(state), true)
  }
  for (const state of ['queued', 'needs_review', 'resolved', 'sent', '']) {
    assert.equal(isDeliveryFact(state), false)
    assert.equal(isFinalDeliveryFailure(state), false)
  }
})
