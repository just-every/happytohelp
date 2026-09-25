/** Fictional, persisted walkthrough histories; no provider output or jobs. */
type Message = readonly [minutes: number, role: 'contact' | 'operator', content: string]
type Visit = readonly [minutes: number, path: string]
type Session = { messages: readonly Message[]; visits: readonly Visit[] }
type Story = { key: string; name: string; subject: string; assigned: boolean; earlier: Session; recent: Session; notes: readonly [number, string][] }

export const demoRichStories: readonly Story[] = [
  {
    key: 'group-hike', name: 'Leah Park', subject: 'Planning a group day hike', assigned: false,
    earlier: {
      visits: [[0, '/guides/group-day-hikes'], [1, '/collections/daypacks'], [2, '/products/ridge-18']],
      messages: [
        [3, 'contact', 'Hi! I’m organising a day hike for five friends next weekend. We’re comparing the Ridge 18 and Summit 24.'],
        [4, 'contact', 'Two of us will carry the shared lunch, so we may need different sizes.'],
        [5, 'contact', 'I’ve just opened your group hiking guide. Is the packing list for each person or for the whole group?'],
        [9, 'operator', 'The example list separates personal essentials from shared equipment. Each person still needs their own water, layers and any personal medication.'],
        [10, 'operator', 'For the lunch carriers, start with the bulk of the shared food as well as their own kit. The extra space in the Summit 24 could help, but a comfortable loaded fit matters too.'],
        [13, 'contact', 'That makes sense. We’ll lay everything out together tonight.'],
        [14, 'contact', 'I’ll come back once we know who is bringing what.'],
      ],
    },
    recent: {
      visits: [[0, '/guides/group-day-hikes'], [1, '/products/summit-24'], [2, '/guides/daypack-fit'], [26, '/guides/packing-checklist']],
      messages: [
        [3, 'contact', 'Back with our packing list! Two people have the lunch and one has a small group first-aid kit.'],
        [4, 'contact', 'We also realised nobody had claimed the picnic blanket. It’s quite bulky.'],
        [8, 'operator', 'Welcome back, Leah. Could the blanket carrier take one of the larger packs, leaving lunch split between the other two?'],
        [9, 'operator', 'Try the full load before choosing sizes. The fit guide you opened has a useful shoulder-strap check.'],
        [12, 'contact', 'Yes, that sounds easier. We can swap the blanket if the pack feels awkward.'],
        [24, 'contact', 'One more thing after looking at the checklist: should we pack a separate rain cover?'],
        [25, 'contact', 'The forecast is mixed, and two of the group haven’t hiked before.'],
        [29, 'operator', 'Check the cover supplied with each actual pack, and keep anything that must stay dry in a suitable waterproof bag. A cover alone won’t seal every opening.'],
        [30, 'operator', 'How long is the route, and will you have an easy way to turn back if the weather changes?'],
      ],
    },
    notes: [[17, 'Fictional group-planning example. Leah is coordinating five walkers; shared loads are now split. Leave this open and unassigned for the next available teammate.']],
  },
  {
    key: 'strap-followup', name: 'Owen Reed', subject: 'Damaged shoulder strap follow-up', assigned: true,
    earlier: {
      visits: [[0, '/help/product-care'], [1, '/guides/checking-pack-straps'], [2, '/help/repairs']],
      messages: [
        [3, 'contact', 'I’ve noticed loose stitching where the left shoulder strap joins my Ridge 18.'],
        [4, 'contact', 'It’s on the sample order DEMO-2086. I haven’t loaded it again since spotting it.'],
        [8, 'operator', 'Thanks for stopping to check, Owen. Please keep the pack out of use while the strap attachment is assessed.'],
        [9, 'operator', 'Can you describe whether the loose thread is on the edge binding or across the strap attachment itself? No personal order details are needed for this demo.'],
        [13, 'contact', 'It looks like a short loose thread on the edge. The main rows still look even.'],
        [16, 'operator', 'That description helps, but it isn’t enough to confirm that a load-bearing part is sound. The repair guide shows which areas an assessor would inspect.'],
        [19, 'contact', 'Understood. I’ll compare it with the guide before doing anything else.'],
      ],
    },
    recent: {
      visits: [[0, '/help/repairs'], [1, '/guides/checking-pack-straps'], [2, '/help/returns'], [23, '/help/repairs/packing']],
      messages: [
        [3, 'contact', 'I’m back about the strap. In better light I can see a gap in the main stitching as well.'],
        [4, 'contact', 'It’s about a centimetre wide, right where the strap joins the top of the pack.'],
        [5, 'contact', 'I haven’t tried to sew it or used it since we spoke.'],
        [9, 'operator', 'Thanks for the update. Keep it out of use; I’m taking ownership of this follow-up so you have one person handling the next step.'],
        [10, 'operator', 'In this fictional case, the next step would be a repair assessment. We haven’t booked a return or issued a shipping label.'],
        [15, 'contact', 'That’s fine. I opened the returns page but wasn’t sure whether I should start there.'],
        [18, 'operator', 'Let’s confirm the assessment route first so you don’t submit two requests. Keep the sample order reference with the pack and leave the damaged area as it is.'],
        [26, 'contact', 'I’ve read the packing guide now. Should I include the removable rain cover if the pack goes in for assessment?'],
        [27, 'contact', 'There’s no rush on a replacement; I mainly want to know what needs to go in the parcel.'],
      ],
    },
    notes: [
      [7, 'Fictional case history: the earlier question was considered closed after the initial description, then reopened when Owen reported a gap in the main stitching. This note records the narrative; no historical status-change event is asserted.'],
      [20, 'Owner is handling the strap follow-up. Awaiting clarification on assessment packing requirements; no return, label, refund or replacement has been created.'],
    ],
  },
]
