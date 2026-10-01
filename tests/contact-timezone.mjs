// A contact's local clock is shown only for a recorded, known timezone (never the viewer's clock, never a Moment error).
import assert from 'node:assert/strict'
import {contactTimezone} from '../src/ui/dashboard/utils/contactTimezone.js'

assert.equal(contactTimezone({timezone:'Europe/Lisbon'}),'Europe/Lisbon')
assert.equal(contactTimezone({timezone:'Asia%2FTokyo'}),'Asia/Tokyo','URL-encoded zones are decoded')
assert.equal(contactTimezone({timezone:' America%2FNew_York '}),'America/New_York')
for(const contact of [undefined,null,{},{timezone:undefined},{timezone:null},{timezone:''},{timezone:'   '},{timezone:'undefined'},{timezone:'Not/AZone'},{timezone:'%E0%A4%A'},{timezone:42},{timezone:{}}])
 assert.equal(contactTimezone(contact),null,`${JSON.stringify(contact)} has no usable timezone`)

// Rendering a contact without a zone must not reach moment-timezone with a made-up name.
const moment=(await import('moment-timezone')).default,logged=[],original=console.error
console.error=(...args)=>logged.push(args.join(' '))
try{for(const contact of [{},{timezone:'undefined'},{timezone:'Not/AZone'}])if(contactTimezone(contact))moment().tz(contactTimezone(contact))}finally{console.error=original}
assert.deepEqual(logged,[],'no Moment Timezone errors for contacts without a known timezone')
console.log('Contact timezone: recorded zones decode, missing and unknown zones yield no clock, no Moment errors passed')
