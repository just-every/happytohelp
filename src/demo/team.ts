// The sample help desk's company, people and workspaces. Fictional throughout:
// Fernwood Home is an invented US home-goods store; every address is .example.

export const company = {
  name: 'Fernwood Home',
  website: 'https://fernwoodhome.example',
  colour: '#2f6f5e',
  timezone: 'America/Los_Angeles',
  helpSlug: 'fernwood',
}

export type AgentKey = 'owner' | 'priya' | 'diego' | 'hannah' | 'sam'
export type InboxKey = 'home' | 'trade'

/** The owner is whoever claimed the demo; only their display name is set here. */
export const ownerName = 'Jordan Ellis'

export const teammates: { key: Exclude<AgentKey, 'owner'>; name: string; email: string; role: 'admin' | 'operator'; inboxes: InboxKey[] }[] = [
  { key: 'priya', name: 'Priya Shah', email: 'priya.shah@fernwoodhome.example', role: 'admin', inboxes: ['home', 'trade'] },
  { key: 'diego', name: 'Diego Alvarez', email: 'diego.alvarez@fernwoodhome.example', role: 'operator', inboxes: ['home'] },
  { key: 'hannah', name: 'Hannah Kim', email: 'hannah.kim@fernwoodhome.example', role: 'operator', inboxes: ['home'] },
  { key: 'sam', name: 'Sam Okafor', email: 'sam.okafor@fernwoodhome.example', role: 'operator', inboxes: ['home', 'trade'] },
]

/** The claimed workspace becomes Fernwood Home; Fernwood Trade is the second inbox. */
export const tradeInbox = {
  id: 'demo-fernwood-trade',
  name: 'Fernwood Trade',
  website: 'https://trade.fernwoodhome.example',
  colour: '#8a5a2b',
}

export const mailboxes: Record<InboxKey, { fromName: string; fromAddress: string; inbound: string }> = {
  home: { fromName: 'Fernwood Home Support', fromAddress: 'support@fernwoodhome.example', inbound: 'support@fernwoodhome.example' },
  trade: { fromName: 'Fernwood Trade', fromAddress: 'trade@fernwoodhome.example', inbound: 'trade@fernwoodhome.example' },
}

export const assistant = {
  name: 'Fern',
  role: 'Fernwood Home support assistant',
  model: 'gpt-5.6-luna',
  prompt: `You are Fern, the support assistant for Fernwood Home, a US store for linen bedding, cast-iron cookware and stoneware. Answer from the published help center and this conversation. Be warm and brief. Never promise a refund, replacement or delivery date yourself: hand those to the team. Ask one focused question when an order number or photo is missing.`,
}

export const tags = ['Shipping', 'Returns', 'Damaged item', 'Sleep trial', 'Cast iron care', 'Wholesale', 'Billing', 'VIP'] as const
export type Tag = typeof tags[number]

export const savedReplies: { inbox: InboxKey; by: AgentKey; title: string; content: string }[] = [
  { inbox: 'home', by: 'priya', title: 'Order status: where is my order?', content: 'Thanks for reaching out! Orders ship within 2 business days from our Portland warehouse, and you get a tracking link by email as soon as the label is printed. If you share your order number (it starts with FH-), I’ll check exactly where yours is.' },
  { inbox: 'home', by: 'priya', title: 'Return label sent', content: 'I’ve emailed you a prepaid return label. Pack the item in any sturdy box, drop it at any UPS location, and your refund goes back to the original payment method within 5 business days of it reaching us.' },
  { inbox: 'home', by: 'hannah', title: 'Damaged on arrival: photo request', content: 'I’m so sorry it arrived like that. Could you send a photo of the item and the outside of the box? Once I have those I’ll send a replacement right away. There’s no need to return the damaged one.' },
  { inbox: 'home', by: 'diego', title: 'Cast iron: rescue rusty skillet', content: 'Good news: rust on cast iron is almost always fixable. Scrub the spot with steel wool and warm water, dry it on the stove, then rub in a thin layer of oil and bake upside down at 450°F for an hour. Our skillets carry a lifetime warranty if it ever cracks.' },
  { inbox: 'home', by: 'hannah', title: '60-night sleep trial explained', content: 'All Fernwood bedding comes with a 60-night sleep trial. Wash it, sleep on it, and if it isn’t right we’ll pick it up and refund you in full, even if it’s been used.' },
  { inbox: 'home', by: 'owner', title: 'Address change before shipping', content: 'I can update the address as long as the order hasn’t been packed yet. I’ve made the change and you’ll see the new address on your shipping confirmation.' },
  { inbox: 'home', by: 'priya', title: 'Gift note and gift receipt', content: 'Happy to add a gift note! Reply with the message you’d like (up to 200 characters) and I’ll add it along with a gift receipt that leaves out prices.' },
  { inbox: 'trade', by: 'sam', title: 'Trade program: application received', content: 'Thanks for applying to Fernwood Trade! We review applications within 2 business days. Approved accounts get 25% off retail, net-30 terms after the first order, and a dedicated contact on our team.' },
  { inbox: 'trade', by: 'sam', title: 'Wholesale minimums', content: 'Our opening wholesale order minimum is $500 and reorders have no minimum. Linen bedding ships in case packs of 4; cookware and stoneware can be ordered by the unit.' },
  { inbox: 'trade', by: 'priya', title: 'Net-30 invoice terms', content: 'Net-30 terms apply from the second order onward. Invoices are emailed when the order ships, and you can pay by ACH or card from the link on the invoice.' },
]
