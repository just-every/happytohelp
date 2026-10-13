export function usd(value) {
 if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'Unknown'
 if (value > 0 && value < 0.000001) return '<$0.000001'
 return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
}
// `summary` is the card's one line; `amount` and `label` are the longer statement kept in its details.
export function spendPresentation(spend) {
 if (spend.state === 'empty') return { summary: 'No recorded spend today', amount: 'No recorded spend', label: 'No measured conversation AI rounds in this period.' }
 if (spend.state === 'unknown') return { summary: 'Spend today is unknown', amount: 'Unknown', label: 'Provider cost has not been fully reported.' }
 if (spend.state === 'partial') return { summary: `${usd(spend.knownUsd)} reported today, total unknown`, amount: `${usd(spend.knownUsd)} reported`, label: 'Partial cost: the total is unknown.' }
 return { summary: `${usd(spend.knownUsd)} today`, amount: usd(spend.knownUsd), label: 'Provider-reported cost for recorded conversation AI rounds.' }
}
