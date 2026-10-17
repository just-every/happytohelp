import type { Env } from '../platform/env'
import type { Generation } from '../modules/ai-support/repository'

// Demo copies have no model key and make no paid call: a generation returns a
// believable answer at once, chosen by what the customer last asked about. Only
// demo mode reaches this (generation-provider.ts wraps the real call in demoEffect).
type Topic = { test: RegExp; button: string; icon: string; reply: (name: string) => string }
const topics: Topic[] = [
  { test: /damag|broken|crack|chip|arrived/i, button: 'Replace it', icon: 'package-check',
    reply: name => `I’m so sorry it arrived like that, ${name}. I’ve set up a replacement to ship today at no charge, and there’s no need to send the damaged one back. You’ll get a tracking link by email as soon as it leaves our Portland warehouse.` },
  { test: /return|refund|exchange|send (it|them) back/i, button: 'Start the return', icon: 'undo-2',
    reply: name => `Of course, ${name}. I’ve emailed you a prepaid UPS return label. Pack it in any sturdy box and drop it at a UPS location; your refund goes back to the original payment method within 5 business days of it reaching us.` },
  { test: /ship|track|deliver|where is|package|arrive|address/i, button: 'Check the order', icon: 'truck',
    reply: name => `Thanks for checking in, ${name}! Orders leave our Portland warehouse within 2 business days and standard delivery takes 3–5 business days. If you share your order number (it starts with FH-), I’ll look up exactly where yours is.` },
  { test: /rust|skillet|cast iron|season/i, button: 'Rescue the skillet', icon: 'flame',
    reply: name => `Good news, ${name}: cast iron is very hard to ruin. Scrub the rough spots with steel wool, dry the pan on the stove, wipe in a thin layer of oil and bake it upside down at 450°F for an hour. If it still isn’t right after that, our lifetime warranty has you covered.` },
  { test: /sheet|linen|duvet|pill|sleep|bed/i, button: 'Sleep trial options', icon: 'bed-double',
    reply: name => `Thanks for telling us, ${name}. Linen softens and settles over the first few washes, and every set comes with our 60-night sleep trial. If it still isn’t right, we’ll pick it up for free and refund you in full, even after use.` },
  { test: /wholesale|trade|retail|minimum|invoice|line sheet/i, button: 'Trade program', icon: 'store',
    reply: name => `Thanks for your interest, ${name}! Fernwood Trade accounts get 25% off retail, a $500 opening minimum with no reorder minimum, and net-30 terms from the second order. I can send our line sheet and set up your account today.` },
  { test: /code|discount|price|charge|gift card|promo/i, button: 'Fix the price', icon: 'badge-percent',
    reply: name => `Thanks for letting us know, ${name}. I’ve applied the discount to your order and refunded the difference to your card; it can take 3–5 business days to show on your statement.` },
]
const fallback: Topic = { test: /./, button: 'Answer the question', icon: 'message-circle',
  reply: name => `Thanks for reaching out, ${name}! Happy to help with that. Could you share your order number (it starts with FH-) so I can look into the details for you?` }

// Everything the customer has written in this conversation, oldest first: the topic is often in the first message.
async function customerAsk(env: Env, row: Generation) {
  const asked = await env.DB.prepare(`SELECT m.content,ct.name FROM messages m JOIN conversations c ON c.id=m.conversation_id JOIN contacts ct ON ct.id=c.contact_id
    WHERE m.conversation_id=? AND m.project_id=? AND m.actor_role='contact' ORDER BY m.revision`).bind(row.conversation_id, row.project_id).all<{ content: string; name: string | null }>()
  const first = asked.results[0]?.name?.trim().split(/\s+/)[0] || 'there'
  return { text: asked.results.map(item => item.content).join('\n'), goal: asked.results[0]?.content ?? '', name: first }
}

/** What a model run would have returned, shaped like the real result for each generation kind. */
export async function demoGeneration(env: Env, row: Generation, options: { tool?: string; message?: string }) {
  const { text, goal, name } = await customerAsk(env, row)
  const topic = topics.find(item => item.test.test(text)) ?? fallback
  if (row.kind === 'reply') return { response: topic.reply(name) }
  if (options.tool) {
    const draft = options.message?.trim() || topic.reply(name)
    return { response: options.tool === 'shorten' ? draft.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') : draft }
  }
  const second = topics.find(item => item !== topic && item.test.test(text))
  return {
    user_goal: goal.length > 140 ? `${goal.slice(0, 137)}…` : goal,
    responses: [
      { button: topic.button, icon: topic.icon, response: topic.reply(name), use_when: '', evidence_ids: [] },
      ...(second ? [{ button: second.button, icon: second.icon, response: second.reply(name), use_when: 'If the customer’s main concern is the second topic they raised.', evidence_ids: [] }] : []),
    ],
    missing_information: /FH-\d+/.test(text) ? [] : ['The customer’s order number'],
  }
}
