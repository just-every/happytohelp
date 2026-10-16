// Only the paid mail edge is replaced; admission, scheduling and delivery run normally.
export default async function notificationMail(request){
 if(new URL(request.url).origin!=='https://api.resend.com')throw Error('Unexpected outbound request')
 const {to,subject,text}=await request.json()
 if(subject==='Unread HappyToHelp conversation messages')console.log('NOTIFICATION_MAIL',JSON.stringify({to,subject,text}))
 return Response.json({id:crypto.randomUUID()})
}
