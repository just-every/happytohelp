/** Every message the SendGrid account handled between two times, from every sender (Email
 * Activity API): counts per sender and status, and whether each recipient is one of the
 * fleet's own addresses. Never prints a recipient address, a subject or content. */
export async function mailActivity({since,until,fleetDomain}){
  const key=process.env.SENDGRID_API_KEY;if(!key)throw Error('The mail check reads SendGrid activity with SENDGRID_API_KEY');
  const query=`last_event_time BETWEEN TIMESTAMP "${since}" AND TIMESTAMP "${until}"`;
  const response=await fetch('https://api.sendgrid.com/v3/messages?'+new URLSearchParams({limit:'1000',query}),{headers:{Authorization:`Bearer ${key}`}});
  if(!response.ok)throw Error(`SendGrid activity returned ${response.status}`);
  const messages=(await response.json()).messages||[],fleet=m=>String(m.to_email||'').toLowerCase().endsWith('@'+fleetDomain),senders={};
  for(const m of messages){const s=senders[m.from_email]??={messages:0,fleetRecipients:0,otherRecipients:0,statuses:{}};s.messages++;s[fleet(m)?'fleetRecipients':'otherRecipients']++;s.statuses[m.status]=(s.statuses[m.status]||0)+1;}
  return {since,until,messages:messages.length,complete:messages.length<1000,otherRecipients:messages.filter(m=>!fleet(m)).length,senders};
}
