export function usd(value) {
 if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'Unknown'
 if (value > 0 && value < 0.000001) return '<$0.000001'
 return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
}
export function spendPresentation(spend) {
 if (spend.state === 'empty') return { amount: 'No recorded spend', label: 'No measured conversation AI rounds in this period.' }
 if (spend.state === 'unknown') return { amount: 'Unknown', label: 'Provider cost has not been fully reported.' }
 if (spend.state === 'partial') return { amount: `${usd(spend.knownUsd)} reported`, label: 'Partial cost: the total is unknown.' }
 return { amount: usd(spend.knownUsd), label: 'Provider-reported cost for recorded conversation AI rounds.' }
}
