// Fernwood Home's small published help center (fictional policies).
export const categories = [
  { key: 'orders', name: 'Orders & shipping', summary: 'Tracking, delivery times and changing an order.' },
  { key: 'returns', name: 'Returns & the sleep trial', summary: 'Sending something back and how refunds work.' },
  { key: 'care', name: 'Product care', summary: 'Looking after linen, cast iron and stoneware.' },
] as const

export const articles: { key: string; category: typeof categories[number]['key']; title: string; summary: string; content: string; draft?: boolean }[] = [
  { key: 'shipping-times', category: 'orders', title: 'Shipping times and costs', summary: 'Free shipping over $75 in the contiguous US.',
    content: 'Orders ship from our Portland, Oregon warehouse within 2 business days.\n\n| Destination | Cost | Typical time |\n| --- | --- | --- |\n| Contiguous US, orders over $75 | Free | 3–5 business days |\n| Contiguous US, under $75 | $8 | 3–5 business days |\n| Express (contiguous US) | $24 | 1–2 business days |\n| Alaska and Hawaii | $25 | 5–8 business days |\n\nYou get a tracking link by email as soon as the label is printed.' },
  { key: 'change-order', category: 'orders', title: 'Changing or cancelling an order', summary: 'Changes are possible until the order is packed.',
    content: 'We can change the address, swap a color or cancel an order until it is packed, usually within a few hours of ordering. Message us with your order number (it starts with **FH-**) and we will confirm the change by email. Once an order has shipped, you can return it instead.' },
  { key: 'showroom-pickup', category: 'orders', title: 'Picking up at the Portland showroom', summary: 'Free same-day pickup on SE Division St.',
    content: 'Choose **Showroom pickup** at checkout. We email you when the order is ready, usually the same day. The showroom is open Wednesday to Sunday, 10am–6pm.' },
  { key: 'returns-policy', category: 'returns', title: 'Our return policy', summary: '30 days for unused items, free return labels.',
    content: 'Unused items can be returned within 30 days of delivery. We email a prepaid UPS label, and refunds go back to the original payment method within 5 business days of the return reaching us. Gifts can be returned for store credit without notifying the giver.' },
  { key: 'sleep-trial', category: 'returns', title: 'The 60-night sleep trial', summary: 'Try our bedding for 60 nights, even after washing.',
    content: 'All Fernwood bedding comes with a 60-night sleep trial. Wash it, sleep on it, and if it isn’t right, message us: we schedule a free UPS pickup and refund you in full once it is collected.' },
  { key: 'damaged-items', category: 'returns', title: 'If something arrives damaged', summary: 'Send a photo and we will replace it, no return needed.',
    content: 'Send us a photo of the item and the outside of the box. We ship a replacement right away, and you don’t need to return the damaged item.' },
  { key: 'linen-care', category: 'care', title: 'Caring for linen bedding', summary: 'Wash cool, tumble dry low, skip the softener.',
    content: 'Machine wash cool on a gentle cycle and tumble dry low, taking it out while still slightly damp. Avoid fabric softener and bleach. Linen softens noticeably over the first five or six washes.' },
  { key: 'cast-iron-care', category: 'care', title: 'Cast iron care and the lifetime warranty', summary: 'Seasoning, rust rescue and what the warranty covers.',
    content: 'Our skillets arrive pre-seasoned. After washing, dry on the stove and wipe in a drop of oil.\n\n**Rust?** Scrub with steel wool, dry, oil lightly and bake upside down at 450°F for an hour.\n\nEvery Fernwood cast-iron piece has a **lifetime warranty** against cracking and warping.' },
  { key: 'stoneware-care', category: 'care', title: 'Stoneware: oven, microwave and dishwasher', summary: 'Safe in all three, with a few tips.',
    content: 'Hearth stoneware is oven safe to 450°F, microwave safe and dishwasher safe. Avoid sudden temperature changes, such as moving a dish from the freezer to a hot oven.' },
  { key: 'holiday-hours', category: 'orders', title: 'Holiday shipping deadlines', summary: 'Draft: dates for this year’s holiday season.', draft: true,
    content: 'Order by December 15 for standard delivery before the holidays, or December 20 with express shipping.' },
]
