/** Provider acceptance is evidence of submission, never proof of delivery. */
export type DeliveryFact = 'accepted' | 'delayed' | 'delivered' | 'bounced' | 'rejected' | 'failed' | 'suppressed'

export function isFinalDeliveryFailure(state: string): state is 'bounced' | 'rejected' | 'failed' | 'suppressed' {
  return state === 'bounced' || state === 'rejected' || state === 'failed' || state === 'suppressed'
}

export function isDeliveryFact(state: string): state is DeliveryFact {
  return state === 'accepted' || state === 'delayed' || state === 'delivered' || isFinalDeliveryFailure(state)
}
