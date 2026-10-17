import type { AgentKey, InboxKey, Tag } from './team'

// Fictional customer threads for the sample help desk. `start` is hours before the
// demo began; each message is [minutes after start, speaker, text]. Speakers are
// 'c' (the customer), a teammate key, or 'ai' (Fern, the AI agent).
export type Speaker = 'c' | 'ai' | AgentKey
export type Draft = { goal: string; button: string; icon: string; response: string; alternative?: { button: string; icon: string; response: string; when: string }; missing?: string[] }
export interface Story {
  key: string
  inbox: InboxKey
  via: 'chat' | 'email'
  name: string
  email: string
  about?: string
  phone?: string
  /** open: waiting on the team; waiting: the team replied last; ai: Fern is handling it; solved: closed. */
  state: 'open' | 'waiting' | 'ai' | 'solved'
  agent?: AgentKey
  start: number
  msgs: [number, Speaker, string][]
  tags?: Tag[]
  note?: [AgentKey, number, string]
  draft?: Draft
  rating?: [1 | -1, string]
  /** The operator sent an AI-drafted reply (reports count it as assisted). */
  assisted?: boolean
  unread?: boolean
}

export const stories: Story[] = [
  // ── Waiting on the team: assigned to the owner ──────────────────────────────
  { key: 'linen-pilling', inbox: 'home', via: 'email', name: 'Rachel Moreno', email: 'rachel.moreno@example.com', about: 'Bought the Stonewashed Linen Sheet Set in Sage (Queen).', state: 'open', agent: 'owner', start: 3.2, unread: true, tags: ['Sleep trial'],
    msgs: [[0, 'c', 'Hi there, I bought the stonewashed linen sheets in Sage about five weeks ago (order FH-20418). They’re lovely to sleep on but after three washes the fitted sheet is starting to pill near the foot of the bed. Is that normal for linen? I followed the care card and wash on cold.'],
      [3, 'c', 'Attaching nothing for now but happy to send photos if that helps.']],
    draft: { goal: 'Wants to know if pilling after three washes is normal and what can be done within the sleep trial.', button: 'Explain and offer trial', icon: 'bed-double',
      response: 'Hi Rachel, thanks so much for the detail, and I’m sorry the fitted sheet is pilling. A little surface fuzz can happen in the first few washes while linen softens, but pilling at the foot of the bed this early isn’t what we expect. You’re still well inside your 60-night sleep trial, so you have options: if you send a couple of photos, I can replace the fitted sheet right away, or we can pick up the whole set for a full refund. Which would you prefer?',
      alternative: { button: 'Care tips first', icon: 'sparkles', response: 'Hi Rachel, sorry about the pilling! It often settles once the loose fibers wash out: try a gentle cycle inside out with no fabric softener, and tumble dry low with a couple of wool dryer balls. If it’s still pilling after the next wash, let me know and I’ll send a replacement under your sleep trial.', when: 'If Rachel prefers to try care steps before a replacement.' },
      missing: ['Photos of the pilled area'] } },
  { key: 'dutch-oven-chip', inbox: 'home', via: 'chat', name: 'Kevin Brooks', email: 'kevin.brooks@example.net', state: 'open', agent: 'owner', start: 1.1, unread: true, tags: ['Damaged item'],
    msgs: [[0, 'c', 'hey, my new enameled dutch oven arrived today and theres a chip on the rim of the lid. order FH-20533'],
      [1, 'c', 'the box looked fine so i think it left the warehouse like that'],
      [2, 'ai', 'I’m sorry your Dutch oven arrived chipped, Kevin. That shouldn’t happen. I’m passing this to the team so someone can sort out a replacement for you. Could you add a photo of the chip while you wait?'],
      [9, 'c', 'sure, just uploaded it. its about the size of a pea on the edge']],
    draft: { goal: 'Get a replacement for a Dutch oven lid that arrived chipped.', button: 'Send replacement lid', icon: 'package-check',
      response: 'Thanks for the photo, Kevin, and sorry about that chip. Enamel chips can expose the cast iron underneath, so I don’t want you cooking with it. I’ve set up a replacement lid to ship today at no charge, and there’s no need to send the damaged one back. You’ll get a tracking link by email once it leaves our warehouse.' } },
  { key: 'gift-wrap-deadline', inbox: 'home', via: 'chat', name: 'Lauren Whitaker', email: 'lauren.whitaker@example.org', state: 'open', agent: 'owner', start: 0.6,
    msgs: [[0, 'c', 'Hi! I want to order the Hearth Stoneware set as a wedding gift. The wedding is in Denver on the 25th. If I order today with standard shipping will it get there in time? Also can you include a gift note?'],
      [1, 'ai', 'Congratulations to the couple! Standard shipping usually takes 3–5 business days, and we can add a gift note with a gift receipt that leaves out prices. I’ll ask a teammate to confirm the timing for Denver, since I can’t promise delivery dates.']],
    draft: { goal: 'Confirm a stoneware gift set arrives in Denver before the 25th, with a gift note.', button: 'Confirm timing and note', icon: 'gift',
      response: 'Hi Lauren, what a lovely gift! If you order today, standard shipping to Denver typically arrives in 3–4 business days, so you’re comfortably ahead of the 25th. At checkout, tick “This is a gift” and add your note there; we’ll include a gift receipt without prices. Want me to keep an eye on the order and message you when it ships?' } },
  { key: 'skillet-rust', inbox: 'home', via: 'email', name: 'Tom Nguyen', email: 'tom.nguyen@example.com', state: 'open', agent: 'owner', start: 26, tags: ['Cast iron care'],
    msgs: [[0, 'c', 'Hello, I left my 10" Fernwood skillet soaking overnight (I know, I know) and now it has orange rust spots all over the cooking surface. Is it ruined? It was a gift from my daughter so I’d hate to toss it.'],
      [42, 'owner', 'Hi Tom, it is definitely not ruined. Rust on cast iron is almost always surface-deep. Scrub the spots with steel wool and warm water, dry it on the stove, then rub in a thin layer of oil and bake it upside down at 450°F for an hour. Let me know how it looks afterwards?'],
      [1310, 'c', 'Did the steel wool and oven thing. It looks much better but there’s still a dull patch in the middle that feels a little rough. Should I do it again?']],
    note: ['owner', 1320, 'If the patch is still rough after a second round, offer the lifetime-warranty swap. He mentioned it was a gift.'] },
  { key: 'duvet-size', inbox: 'home', via: 'chat', name: 'Aisha Rahman', email: 'aisha.rahman@example.com', state: 'open', agent: 'owner', start: 5.5,
    msgs: [[0, 'c', 'Quick question: does your king linen duvet cover fit a California king duvet insert? Mine is 104 x 92.'],
      [4, 'owner', 'Hi Aisha! Our king duvet cover is 108 x 92, so a 104 x 92 insert fits with a little room at the sides, which helps it look relaxed.'],
      [11, 'c', 'Perfect. And do the corner ties work with any insert or only yours?']] },

  // ── Waiting on the team: other teammates ────────────────────────────────────
  { key: 'missing-package', inbox: 'home', via: 'email', name: 'Daniel Foster', email: 'dan.foster@example.net', state: 'open', agent: 'priya', start: 20, tags: ['Shipping'],
    msgs: [[0, 'c', 'My tracking for FH-20377 has said “delivered” since Monday but nothing is at my door or with my building’s front desk. Can you help?'],
      [35, 'priya', 'I’m sorry, Daniel. That’s frustrating. I’ve opened a trace with UPS, which usually takes 1–2 business days. In the meantime, could you check with neighbors in case it was left at the wrong unit?'],
      [1120, 'c', 'Checked with neighbors, no luck. Has UPS said anything yet?']],
    note: ['priya', 40, 'UPS trace #1Z-FWD-88213 opened. If nothing by Thursday, reship the order.'] },
  { key: 'bulk-napkins', inbox: 'home', via: 'chat', name: 'Grace Liu', email: 'grace.liu@example.com', state: 'open', agent: 'hannah', start: 4,
    msgs: [[0, 'c', 'Hi, I’m hosting a dinner for 24 people next month. Do you have the linen napkins in sets larger than 4? And is there a discount for buying 6 sets?'],
      [6, 'hannah', 'Hi Grace! The napkins only come in sets of 4, but six sets is no problem at all. There’s no automatic bulk discount, though I can check with my lead about something for an order that size.'],
      [14, 'c', 'That would be great, thanks! Natural or Clay color, either works.']] },
  { key: 'promo-code', inbox: 'home', via: 'chat', name: 'Marcus Reed', email: 'marcus.reed@example.org', state: 'open', agent: 'diego', start: 2.4, tags: ['Billing'],
    msgs: [[0, 'c', 'The code FALLHOME15 from your email isn’t working at checkout. It says expired but the email says it runs through Sunday.'],
      [3, 'diego', 'Thanks for flagging that, Marcus. Let me check what’s going on with the code.'],
      [5, 'c', 'Thanks. I have the cart ready, just waiting on this.']] },
  { key: 'pan-induction', inbox: 'home', via: 'email', name: 'Helen Park', email: 'helen.park@example.com', state: 'open', agent: 'diego', start: 30, tags: ['Cast iron care'],
    msgs: [[0, 'c', 'Will your cast iron grill pan work on an induction cooktop? We’re renovating and switching from gas.'],
      [55, 'diego', 'Hi Helen, yes, all of our cast iron works on induction. One tip: heat it gradually on medium, since induction heats the base very quickly.'],
      [1500, 'c', 'Great, thank you. Is the enameled dutch oven also induction safe, and is it OK on a glass top in general?']] },
  { key: 'wrong-color', inbox: 'home', via: 'email', name: 'Olivia Bennett', email: 'olivia.bennett@example.net', state: 'open', agent: 'hannah', start: 9, unread: true, tags: ['Returns'],
    msgs: [[0, 'c', 'I ordered the waffle bath towels in Fog (FH-20502) but received Charcoal. I’d love to swap them for the right color. Do I need to send these back first?']] },
  { key: 'subscription-candles', inbox: 'home', via: 'chat', name: 'Ethan Clarke', email: 'ethan.clarke@example.com', state: 'open', agent: 'sam', start: 7,
    msgs: [[0, 'c', 'Can I skip next month’s candle refill? I still have two left.'],
      [12, 'sam', 'Of course, Ethan! Is the December delivery the one you’d like to skip, or January?'],
      [20, 'c', 'December please. And can I switch scents for January to Cedar & Smoke?']] },
  { key: 'price-match', inbox: 'home', via: 'email', name: 'Natalie Cruz', email: 'natalie.cruz@example.org', state: 'open', agent: 'priya', start: 48, tags: ['Billing'],
    msgs: [[0, 'c', 'I bought the linen duvet cover last week for $248 and today it’s on sale for $199. Is there any way to get the difference back?'],
      [80, 'priya', 'Hi Natalie, good timing: we honor price adjustments within 14 days of purchase. Could you confirm your order number?'],
      [2700, 'c', 'Sorry for the delay! It’s FH-20291.']] },

  // ── New and unassigned ──────────────────────────────────────────────────────
  { key: 'mattress-topper', inbox: 'home', via: 'chat', name: 'Chris Donovan', email: 'chris.donovan@example.com', state: 'open', start: 0.25, unread: true,
    msgs: [[0, 'c', 'Do you sell a wool mattress topper or just bedding? Looking for something for a guest room.']] },
  { key: 'order-change', inbox: 'home', via: 'chat', name: 'Priyanka Iyer', email: 'priyanka.iyer@example.net', state: 'open', start: 0.4, unread: true, tags: ['Shipping'],
    msgs: [[0, 'c', 'I just placed order FH-20561 and used my old address by mistake. Can you change it to my new apartment before it ships?'],
      [1, 'ai', 'Thanks for reaching out quickly, Priyanka. Address changes are possible until the order is packed. I’m handing this to the team so they can update it. Please don’t share the full address here; they’ll confirm it with you directly.']],
    draft: { goal: 'Update the shipping address on an order that has not shipped yet.', button: 'Confirm address change', icon: 'truck',
      response: 'Hi Priyanka, good catch! FH-20561 hasn’t been packed yet, so I can update the address. I’ve sent a secure link to the email on your order where you can enter the new apartment address. Once it’s saved, you’ll see it on your shipping confirmation.' } },
  { key: 'stoneware-dishwasher', inbox: 'home', via: 'chat', name: 'Ben Carter', email: 'ben.carter@example.com', state: 'open', start: 1.8, unread: true,
    msgs: [[0, 'c', 'Is the Hearth stoneware dishwasher and microwave safe? The product page only mentions the oven.']] },
  { key: 'refund-status', inbox: 'home', via: 'email', name: 'Sophia Martinez', email: 'sophia.martinez@example.org', state: 'open', start: 6, unread: true, tags: ['Returns'],
    msgs: [[0, 'c', 'Hi, I returned the linen apron and tea towels (return RMA-5521) two weeks ago. UPS shows it was delivered to you last Wednesday but I haven’t seen the refund yet. Could you check on it?']] },
  { key: 'wholesale-question-home', inbox: 'home', via: 'email', name: 'Jamal Washington', email: 'jamal@saltandcedar.example', about: 'Owner, Salt & Cedar (gift shop, Asheville NC).', state: 'open', start: 11, unread: true, tags: ['Wholesale'],
    msgs: [[0, 'c', 'Hello, I run a small gift shop in Asheville and would love to carry your candles and tea towels. Do you work with retailers? Who should I talk to?']] },
  { key: 'sheet-sizes', inbox: 'home', via: 'chat', name: 'Emily Sanders', email: 'emily.sanders@example.net', state: 'open', start: 2.9, unread: true, tags: ['Sleep trial'],
    msgs: [[0, 'c', 'my mattress is 16 inches deep. will your fitted sheets stay on? the last ones I bought kept popping off the corners'],
      [1, 'ai', 'Good question, Emily! Our fitted sheets have 17-inch pockets with elastic all the way around, so they’re designed for mattresses up to 16 inches deep. And if they don’t stay put, every set comes with a 60-night sleep trial. Would you like a teammate to help you pick a size?'],
      [4, 'c', 'yes please, queen. also are they warm? I run hot']] },
  { key: 'broken-candle', inbox: 'home', via: 'email', name: 'Victoria Hughes', email: 'victoria.hughes@example.com', state: 'open', start: 14, unread: true, tags: ['Damaged item'],
    msgs: [[0, 'c', 'The glass on one of the three candles in my Cedar & Smoke set was cracked when I opened the box. Order FH-20444. The other two are perfect.']] },

  // ── The team replied; waiting on the customer ───────────────────────────────
  { key: 'exchange-towels', inbox: 'home', via: 'email', name: 'Andrew Kim', email: 'andrew.kim@example.org', state: 'waiting', agent: 'hannah', start: 22, tags: ['Returns'],
    msgs: [[0, 'c', 'Could I exchange my bath sheets for the regular bath towels? The sheets are too big for our towel bars.'],
      [28, 'hannah', 'Absolutely, Andrew! I’ve emailed you a prepaid return label for the bath sheets. As soon as UPS scans it, I’ll ship the bath towels in the same color, so you won’t wait for the return to arrive.']] },
  { key: 'care-instructions', inbox: 'home', via: 'chat', name: 'Mia Johnson', email: 'mia.johnson@example.com', state: 'waiting', agent: 'diego', start: 3.6,
    msgs: [[0, 'c', 'Can I iron the linen tablecloth? It’s very wrinkly out of the package'],
      [2, 'diego', 'Yes, you can! Iron it slightly damp on medium-high heat, or just toss it in the dryer on low for 10 minutes with a damp towel. Most people love the relaxed look after the first wash too.']] },
  { key: 'backorder', inbox: 'home', via: 'email', name: 'Robert Hayes', email: 'robert.hayes@example.net', state: 'waiting', agent: 'owner', start: 34, tags: ['Shipping'],
    msgs: [[0, 'c', 'I ordered the 12" skillet and the lid together (FH-20350). The skillet arrived but the lid didn’t. Did you forget it?'],
      [20, 'owner', 'Hi Robert, not forgotten! The lid was on backorder and is now scheduled to ship on Friday from our Portland warehouse. You won’t pay any extra shipping. Would you like me to email you the tracking as soon as it moves?']] },
  { key: 'gift-card', inbox: 'home', via: 'chat', name: 'Chloe Adams', email: 'chloe.adams@example.org', state: 'waiting', agent: 'priya', start: 1.5, tags: ['Billing'],
    msgs: [[0, 'c', 'Can I use two gift cards on one order?'],
      [3, 'priya', 'Yes, you can apply up to five gift cards to a single order. Enter them one at a time in the gift card field at checkout, and any remaining balance can go on a card.']], assisted: true },
  { key: 'sleep-trial-pickup', inbox: 'home', via: 'email', name: 'Samantha Ortiz', email: 'samantha.ortiz@example.com', state: 'waiting', agent: 'hannah', start: 50, tags: ['Sleep trial', 'Returns'],
    msgs: [[0, 'c', 'I’d like to use the sleep trial for the linen duvet cover. It’s beautiful but too heavy for us in Phoenix. What do I do?'],
      [40, 'hannah', 'Thanks for giving it a try, Samantha. I’ve scheduled a free UPS pickup for the duvet cover. Could you let me know which day this week works best? A refund goes back to your card once it’s collected.']] },

  // ── Fern (the AI agent) is handling these ───────────────────────────────────
  { key: 'ai-shipping-cost', inbox: 'home', via: 'chat', name: 'Zoe Mitchell', email: 'zoe.mitchell@example.com', state: 'ai', start: 0.8,
    msgs: [[0, 'c', 'How much is shipping to Vermont?'],
      [0.5, 'ai', 'Hi Zoe! Shipping is free on orders over $75 anywhere in the contiguous US, including Vermont. Below $75, standard shipping is a flat $8 and usually takes 3–5 business days.'],
      [2, 'c', 'and how fast is express?']] },
  { key: 'ai-care-linen', inbox: 'home', via: 'chat', name: 'Lucas Turner', email: 'lucas.turner@example.net', state: 'ai', start: 3,
    msgs: [[0, 'c', 'can I put linen sheets in the dryer?'],
      [0.5, 'ai', 'Yes! Tumble dry on low and remove them while they’re still slightly damp. That keeps the linen soft and avoids extra shrinking. Skip fabric softener, as it coats the fibers.'],
      [3, 'c', 'great thanks']] },
  { key: 'ai-store-hours', inbox: 'home', via: 'chat', name: 'Ava Robinson', email: 'ava.robinson@example.org', state: 'solved', start: 28, rating: [1, 'Quick and clear, thanks!'],
    msgs: [[0, 'c', 'Do you have a store in Portland I can visit?'],
      [0.5, 'ai', 'We do! The Fernwood Home showroom is on SE Division St in Portland, open Wednesday to Sunday, 10am–6pm. You can see the full bedding and stoneware collections there.'],
      [2, 'c', 'perfect, see you saturday']] },
  { key: 'ai-oven-safe', inbox: 'home', via: 'chat', name: 'Henry Walsh', email: 'henry.walsh@example.com', state: 'solved', start: 52, rating: [1, ''],
    msgs: [[0, 'c', 'What temperature is the enameled dutch oven safe to?'],
      [0.5, 'ai', 'The enameled Dutch oven is oven safe up to 500°F, including the lid knob. On the stovetop, medium heat is best for enamel.'],
      [3, 'c', 'thank you!']] },
  { key: 'ai-returns-window', inbox: 'home', via: 'chat', name: 'Isabella Price', email: 'isabella.price@example.net', state: 'solved', start: 76,
    msgs: [[0, 'c', 'how long do I have to return stoneware?'],
      [0.5, 'ai', 'You have 30 days from delivery to return unused stoneware for a full refund. Bedding has a 60-night sleep trial instead, so you can return it even after use.']] },
  { key: 'ai-handoff-warranty', inbox: 'home', via: 'chat', name: 'Owen Fletcher', email: 'owen.fletcher@example.com', state: 'solved', agent: 'diego', start: 98, tags: ['Cast iron care'], rating: [1, 'Diego was great, new skillet already on the way.'],
    msgs: [[0, 'c', 'My skillet cracked down the middle when I put it on the burner. Is that covered?'],
      [0.5, 'ai', 'I’m sorry to hear that, Owen. Our cast iron has a lifetime warranty against cracking. I’m bringing in a teammate to set up the replacement.'],
      [12, 'diego', 'Hi Owen, Diego here. That’s definitely covered. A new 10" skillet is on its way, and you’ll get tracking by email today. No need to return the cracked one; please recycle it.'],
      [20, 'c', 'Wow, that was fast. Thanks Diego!']] },

  // ── Fernwood Trade (email) ─────────────────────────────────────────────────
  { key: 'trade-application', inbox: 'trade', via: 'email', name: 'Margaret O’Neil', email: 'margaret@oneilinteriors.example', about: 'Principal, O’Neil Interiors (Boston, MA). Interior designer.', state: 'open', agent: 'sam', start: 18, tags: ['Wholesale'],
    msgs: [[0, 'c', 'Hello Fernwood team, I’m an interior designer in Boston and I applied for a trade account on Monday. I have a client project that needs bedding for six rooms. Any update on the application?'],
      [30, 'sam', 'Hi Margaret, thanks for applying! Your application is approved. Welcome to Fernwood Trade. You’ll get 25% off retail on every order and I’ll be your contact here. Would it help if I put together a quote for the six rooms?'],
      [600, 'c', 'Yes please! Five queens and one king, all in the Natural linen. Duvet covers, sheet sets and two shams per bed.']],
    draft: { goal: 'Get a trade quote for six rooms of Natural linen bedding.', button: 'Send the quote', icon: 'receipt',
      response: 'Hi Margaret, here’s your trade quote for six rooms in Natural linen: 5 queen duvet covers, 1 king duvet cover, 5 queen sheet sets, 1 king sheet set and 12 standard shams. With your 25% trade discount the total comes to $5,163.75 before shipping, and orders over $2,500 ship free. Shall I convert it to an order? Net-30 terms start from your second order, so this first one would be paid by card or ACH.',
      missing: ['Delivery address and in-hands date for the project'] } },
  { key: 'trade-reorder', inbox: 'trade', via: 'email', name: 'Tyler Grant', email: 'tyler@pineandpebble.example', about: 'Buyer, Pine & Pebble (boutique, Bend OR). Trade account since March.', state: 'open', agent: 'priya', start: 8, unread: true, tags: ['Wholesale', 'VIP'],
    msgs: [[0, 'c', 'Hi Priya, our holiday window is coming together and we’re nearly sold out of the Cedar & Smoke candles. Can we reorder 48 units with the same terms as last time? Ideally shipped by the 10th.']] },
  { key: 'trade-invoice', inbox: 'trade', via: 'email', name: 'Linda Chavez', email: 'accounts@hearthandhome.example', about: 'Accounts payable, Hearth & Home Mercantile (Santa Fe, NM).', state: 'waiting', agent: 'sam', start: 40, tags: ['Wholesale', 'Billing'],
    msgs: [[0, 'c', 'Could you resend invoice INV-3381? Our accounting system didn’t pick it up and it’s due next week.'],
      [25, 'sam', 'Hi Linda, I’ve resent INV-3381 to accounts@hearthandhome.example and attached a PDF copy here as well. The due date is the 30th; let me know if you’d like to pay by ACH and I’ll send the details.']] },
  { key: 'trade-minimums', inbox: 'trade', via: 'email', name: 'Kenji Watanabe', email: 'kenji@morningwares.example', about: 'Co-owner, Morning Wares (Seattle, WA).', state: 'open', start: 3.8, unread: true, tags: ['Wholesale'],
    msgs: [[0, 'c', 'We’re a café and home goods shop in Seattle. What’s your wholesale minimum for the stoneware mugs, and do you offer case pricing?']] },
  { key: 'trade-damaged', inbox: 'trade', via: 'email', name: 'Rosa Delgado', email: 'rosa@casaclara.example', about: 'Owner, Casa Clara (Austin, TX).', state: 'solved', agent: 'sam', start: 120, tags: ['Wholesale', 'Damaged item'], rating: [1, 'Sam always takes care of us.'],
    msgs: [[0, 'c', 'Two of the 24 stoneware bowls in our last case arrived broken. Photos attached. How do we handle this for wholesale?'],
      [45, 'sam', 'Sorry about that, Rosa. I’ve credited two bowls to your account and added replacements to your next shipment. No need to send the broken ones back.'],
      [130, 'c', 'Perfect, thanks Sam.']] },
  { key: 'trade-catalog', inbox: 'trade', via: 'email', name: 'Ian Murphy', email: 'ian@northlightstudio.example', about: 'Designer, Northlight Studio (Chicago, IL).', state: 'solved', agent: 'priya', start: 170, tags: ['Wholesale'],
    msgs: [[0, 'c', 'Do you have a trade catalog or line sheet for the spring collection?'],
      [60, 'priya', 'Hi Ian! Here’s the spring line sheet with trade pricing and lead times. The new Clay and Fog colorways ship from March 1.'],
      [200, 'c', 'Got it, thank you!']] },

  // ── Closed: the last three weeks of history ─────────────────────────────────
  { key: 'h-tracking-1', inbox: 'home', via: 'chat', name: 'Paige Turner', email: 'paige.turner@example.com', state: 'solved', agent: 'hannah', start: 30, tags: ['Shipping'], rating: [1, 'Super helpful'],
    msgs: [[0, 'c', 'Where’s my order? FH-20388'], [4, 'hannah', 'Hi Paige! FH-20388 is out for delivery today with UPS. You should have it by this evening.'], [6, 'c', 'Yay thank you!']] },
  { key: 'h-return-1', inbox: 'home', via: 'email', name: 'George Bailey', email: 'george.bailey@example.net', state: 'solved', agent: 'priya', start: 60, tags: ['Returns'], rating: [1, ''],
    msgs: [[0, 'c', 'I’d like to return the stoneware pasta bowls. They’re a bit smaller than I expected.'], [50, 'priya', 'No problem, George. I’ve emailed a prepaid return label. Your refund will go back to your card within 5 business days of the bowls arriving.'], [90, 'c', 'Thanks, dropped them off at UPS.']] },
  { key: 'h-damaged-1', inbox: 'home', via: 'chat', name: 'Nora Fitzgerald', email: 'nora.fitz@example.org', state: 'solved', agent: 'hannah', start: 80, tags: ['Damaged item'], assisted: true, rating: [1, 'Replacement came in two days!'],
    msgs: [[0, 'c', 'One of the mugs in my set arrived with a crack'], [5, 'hannah', 'I’m so sorry, Nora! Could you send a photo of the mug and the box?'], [9, 'c', 'Here you go'], [12, 'hannah', 'Thank you! A replacement mug ships today, and there’s no need to send the cracked one back.']] },
  { key: 'h-promo-1', inbox: 'home', via: 'chat', name: 'Kyle Benson', email: 'kyle.benson@example.com', state: 'solved', agent: 'diego', start: 100, tags: ['Billing'],
    msgs: [[0, 'c', 'forgot to use my welcome code, can you apply it after?'], [3, 'diego', 'I can! I’ve refunded the 10% welcome discount to your card. It takes 3–5 days to show up.'], [5, 'c', 'awesome']] },
  { key: 'h-sleep-1', inbox: 'home', via: 'email', name: 'Diana Ross', email: 'diana.ross@example.net', state: 'solved', agent: 'hannah', start: 140, tags: ['Sleep trial'], rating: [-1, 'The pickup was rescheduled twice before it actually happened.'],
    msgs: [[0, 'c', 'The linen sheets are too textured for me. Can I return them under the trial?'], [70, 'hannah', 'Of course, Diana. I’ve booked a free pickup for Thursday and your refund will follow once UPS collects them.'], [3000, 'c', 'UPS never came on Thursday.'], [3060, 'hannah', 'I’m sorry, that’s not okay. I’ve rebooked for tomorrow morning and called UPS to confirm.'], [4500, 'c', 'They came today. Thanks.']] },
  { key: 'h-care-1', inbox: 'home', via: 'chat', name: 'Felix Grant', email: 'felix.grant@example.org', state: 'solved', start: 165, rating: [1, ''],
    msgs: [[0, 'c', 'how do I season a new skillet?'], [0.5, 'ai', 'Our skillets come pre-seasoned, so you can cook right away! To build the seasoning, cook something with a little fat for the first few uses, and after washing, dry it on the stove and wipe in a drop of oil.'], [2, 'c', 'easy, thanks']] },
  { key: 'h-tracking-2', inbox: 'home', via: 'email', name: 'Hailey Morgan', email: 'hailey.morgan@example.com', state: 'solved', agent: 'diego', start: 190, tags: ['Shipping'],
    msgs: [[0, 'c', 'Tracking hasn’t updated in four days for FH-20201.'], [40, 'diego', 'Thanks for your patience, Hailey. UPS confirmed a sorting delay in Salt Lake City; it’s moving again and due Monday.'], [3000, 'c', 'Arrived today, thank you!']] },
  { key: 'h-address-1', inbox: 'home', via: 'chat', name: 'Leo Sanchez', email: 'leo.sanchez@example.net', state: 'solved', agent: 'owner', start: 215, tags: ['Shipping'], assisted: true, rating: [1, 'Fixed in a minute'],
    msgs: [[0, 'c', 'Wrong zip code on my order FH-20188!!'], [2, 'owner', 'No worries, Leo, it hasn’t been packed yet. I’ve corrected the zip code and you’ll see it on the shipping confirmation.'], [4, 'c', 'lifesaver']] },
  { key: 'h-bulk-1', inbox: 'home', via: 'email', name: 'Rebecca Stone', email: 'rebecca.stone@example.org', state: 'solved', agent: 'priya', start: 240,
    msgs: [[0, 'c', 'Do you offer corporate gifting? We’d like 40 candle sets for clients.'], [120, 'priya', 'We do! For 40 sets I can offer 15% off and a custom gift note on each. I’ve emailed a quote.'], [600, 'c', 'Approved by our team, placing the order now.']] },
  { key: 'h-return-2', inbox: 'home', via: 'chat', name: 'Simon Patel', email: 'simon.patel@example.com', state: 'solved', agent: 'hannah', start: 265, tags: ['Returns'],
    msgs: [[0, 'c', 'can i return a gift without the giver finding out'], [3, 'hannah', 'Yes! Send us the order number from the gift receipt and we’ll issue store credit to you. The giver isn’t notified.'], [8, 'c', 'perfect thank you']] },
  { key: 'h-care-2', inbox: 'home', via: 'chat', name: 'Wendy Clark', email: 'wendy.clark@example.net', state: 'solved', start: 290,
    msgs: [[0, 'c', 'is the linen tablecloth stain resistant?'], [0.5, 'ai', 'Linen isn’t treated to be stain resistant, but it releases most stains well: blot quickly and wash in cool water. For wine, a little dish soap before washing helps.']] },
  { key: 'h-damaged-2', inbox: 'home', via: 'email', name: 'Arthur Lee', email: 'arthur.lee@example.com', state: 'solved', agent: 'diego', start: 320, tags: ['Damaged item'], rating: [1, ''],
    msgs: [[0, 'c', 'The handle on my Dutch oven lid is loose.'], [60, 'diego', 'Sorry about that, Arthur! The knob screw can loosen in shipping. Tighten it with a Phillips screwdriver, and if it keeps loosening I’ll send a new knob.'], [200, 'c', 'Tightened it, all good now.']] },
  { key: 'h-tracking-3', inbox: 'home', via: 'chat', name: 'Jenna Wright', email: 'jenna.wright@example.org', state: 'solved', agent: 'sam', start: 345, tags: ['Shipping'], rating: [1, 'Fast answer'],
    msgs: [[0, 'c', 'Do you ship to Alaska?'], [2, 'sam', 'We do! Shipping to Alaska and Hawaii is a flat $25 and takes 5–8 business days.'], [4, 'c', 'great, ordering now']] },
  { key: 'h-billing-1', inbox: 'home', via: 'email', name: 'Martin Hall', email: 'martin.hall@example.net', state: 'solved', agent: 'priya', start: 370, tags: ['Billing'], rating: [-1, 'Took two days to get an answer.'],
    msgs: [[0, 'c', 'I was charged twice for order FH-20090.'], [2600, 'priya', 'I’m sorry for the wait, Martin. The second charge was an authorization hold, not a payment, and it has now been released. You’ll see it drop off your statement within 2–3 days.'], [2800, 'c', 'OK, I see it’s pending removal now.']] },
  { key: 'h-sleep-2', inbox: 'home', via: 'chat', name: 'Quinn Harper', email: 'quinn.harper@example.com', state: 'solved', agent: 'hannah', start: 395, tags: ['Sleep trial'], assisted: true, rating: [1, 'Love the sheets'],
    msgs: [[0, 'c', 'do the sheets get softer? they feel a bit crisp'], [4, 'hannah', 'They really do! Linen softens noticeably over the first five or six washes. If they still don’t feel right, you have the full 60-night trial.'], [9, 'c', 'ok will give it time']] },
  { key: 'h-gift-1', inbox: 'home', via: 'chat', name: 'Elena Russo', email: 'elena.russo@example.org', state: 'solved', start: 420,
    msgs: [[0, 'c', 'do you do gift wrapping?'], [0.5, 'ai', 'We do! Choose “This is a gift” at checkout to add a reusable linen wrap for $6, plus a gift note and a gift receipt without prices.'], [3, 'c', 'cute!']] },
  { key: 'h-return-3', inbox: 'home', via: 'email', name: 'Dennis Moore', email: 'dennis.moore@example.com', state: 'solved', agent: 'diego', start: 445, tags: ['Returns'],
    msgs: [[0, 'c', 'My refund hasn’t arrived and it’s been 10 days.'], [35, 'diego', 'Hi Dennis, your refund was issued on the 3rd. Some banks take up to 10 business days to post it; here is the reference number to give your bank: RF-77120.'], [1500, 'c', 'It showed up this morning.']] },
  { key: 'h-tracking-4', inbox: 'home', via: 'chat', name: 'Tara Nelson', email: 'tara.nelson@example.net', state: 'solved', agent: 'owner', start: 470, tags: ['Shipping'], rating: [1, ''],
    msgs: [[0, 'c', 'Can I pick up my order at the Portland showroom instead?'], [5, 'owner', 'Yes! I’ve switched FH-20055 to showroom pickup. We’ll email you when it’s ready, usually the same day.'], [7, 'c', 'Great thanks']] },
  { key: 'h-care-3', inbox: 'home', via: 'email', name: 'Carl Jensen', email: 'carl.jensen@example.org', state: 'solved', agent: 'hannah', start: 495, tags: ['Cast iron care'],
    msgs: [[0, 'c', 'Black flakes are coming off my skillet into food. Is that safe?'], [45, 'hannah', 'Those are bits of carbonized seasoning, Carl. They’re not harmful, but they mean the seasoning needs a refresh: scrub it, dry it, oil it lightly and bake at 450°F for an hour.'], [400, 'c', 'Did it, no more flakes. Thanks!']] },
]
