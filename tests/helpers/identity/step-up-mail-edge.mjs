import assert from 'node:assert/strict'

// Only the provider HTTP boundary is replaced. The browser reads this synthetic mailbox.
export default async request=>{
 assert.equal(request.url,'https://api.resend.com/emails')
 const message=await request.json()
 if(['Confirm your HappyToHelp sign-in','Sign in to HappyToHelp'].includes(message.subject))console.log('STEP_UP_MAILBOX',JSON.stringify(message))
 return Response.json({id:crypto.randomUUID()})
}
