import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {emailEvidence,headerBlockEntries,gatewayHeaderEntries,classifyInboundEmail,evidenceJson,MAX_EVIDENCE_JSON,EVIDENCE_HEADERS}=await import('../src/modules/integrations/email-classification.ts')
const {loopSuppressionHeaders}=await import('../src/modules/integrations/notifications.ts')

const evidence=(headers={},extra={})=>emailEvidence({envelopeFrom:extra.envelopeFrom??'customer@example.com',headerFrom:extra.headerFrom??'Customer <customer@example.com>',subject:extra.subject??'Help with my order',headers:Object.entries(headers).map(([key,value])=>({key,value}))})

test('evidence keeps only the retained headers, first occurrence, bounded and without control characters',()=>{
 const messy=emailEvidence({envelopeFrom:'customer@example.com',headerFrom:null,subject:undefined,headers:[{key:'Precedence',value:null},{key:'List-Id',value:42},null,{key:7,value:'ignored'},{key:'X-Ignored',value:'not retained'},{key:'Auto-Submitted',value:' auto-replied '},{key:'auto-submitted',value:'no'}]})
 assert.deepEqual(messy,{envelope_from:'customer@example.com',header_from:null,subject:null,headers:{'auto-submitted':'auto-replied'}})
 const long=emailEvidence({envelopeFrom:'e'.repeat(400)+'@example.com',headerFrom:'h'.repeat(400),subject:'s'.repeat(400),headers:[{key:'List-Id',value:'l'.repeat(300)}]})
 assert.equal(long.envelope_from.length,320);assert.equal(long.header_from.length,320);assert.equal(long.subject.length,200);assert.equal(long.headers['list-id'].length,200)
 assert.equal(emailEvidence({envelopeFrom:'a@b.example',headerFrom:null,subject:'Out\u0000of\r\noffice',headers:[]}).subject,'Out of office')
 assert.equal(emailEvidence({envelopeFrom:undefined,headerFrom:null,subject:null,headers:[]}).envelope_from,'')
})

test('a raw header block unfolds continuation lines and a gateway header map is read as entries',()=>{
 const entries=headerBlockEntries('Message-ID: <a@example.com>\r\nList-Unsubscribe: <mailto:leave@example.com>,\r\n <https://example.com/leave>\r\nAuto-Submitted: auto-generated\r\nnot a header\r\n')
 assert.deepEqual(entries.map(entry=>entry.key),['Message-ID','List-Unsubscribe','Auto-Submitted'])
 const parsed=emailEvidence({envelopeFrom:'news@example.com',headerFrom:'news@example.com',subject:'News',headers:entries})
 assert.equal(parsed.headers['list-unsubscribe'],'<mailto:leave@example.com>, <https://example.com/leave>')
 assert.equal(parsed.headers['auto-submitted'],'auto-generated')
 assert.deepEqual(gatewayHeaderEntries({'Auto-Submitted':'auto-replied'}),[{key:'Auto-Submitted',value:'auto-replied'}])
 assert.deepEqual(gatewayHeaderEntries(['Auto-Submitted','auto-replied']),[],'a header array is not a header map')
 assert.deepEqual(gatewayHeaderEntries('Auto-Submitted: auto-replied'),[])
})

test('customer mail is not automatic',()=>{
 assert.deepEqual(classifyInboundEmail(evidence()),{automatic:false,reasons:[]})
 assert.deepEqual(classifyInboundEmail(evidence({'Auto-Submitted':'no',Precedence:'normal','X-Auto-Response-Suppress':'None','Message-ID':'<a@example.com>'})),{automatic:false,reasons:[]})
 assert.equal(classifyInboundEmail(evidence({Precedence:'bulk-order'})).automatic,false,'precedence matches whole tokens only')
 assert.equal(classifyInboundEmail(evidence({},{envelopeFrom:'noah@example.com',headerFrom:'reply.team@example.com'})).automatic,false)
})

test('each automatic-mail rule is named in the reasons',()=>{
 for(const [headers,reason] of [[{'Auto-Submitted':'auto-replied'},'auto-submitted'],[{Precedence:'bulk'},'precedence'],[{Precedence:'auto_reply'},'precedence'],[{'X-Auto-Response-Suppress':'All'},'x-auto-response-suppress'],[{'List-Id':'<announce.example.com>'},'list-id'],[{'List-Unsubscribe':'<mailto:leave@example.com>'},'list-unsubscribe'],[{'X-Autoreply':'yes'},'x-autoreply'],[{'X-Autorespond':'Out of office'},'x-autoreply'],[{'Return-Path':'<>'},'null-sender']]){
  assert.deepEqual(classifyInboundEmail(evidence(headers)),{automatic:true,reasons:[reason]},reason)
 }
 assert.deepEqual(classifyInboundEmail(evidence({},{envelopeFrom:'MAILER-DAEMON@example.com',headerFrom:'Mail Delivery System <MAILER-DAEMON@example.com>'})),{automatic:true,reasons:['mailer-daemon']})
 assert.deepEqual(classifyInboundEmail(evidence({},{envelopeFrom:'postmaster@example.com'})),{automatic:true,reasons:['mailer-daemon']})
 for(const sender of ['noreply@example.com','no-reply-billing@example.com','no_reply@example.com','donotreply@example.com','do-not-reply@example.com'])assert.deepEqual(classifyInboundEmail(evidence({},{envelopeFrom:sender})),{automatic:true,reasons:['no-reply']},sender)
 assert.deepEqual(classifyInboundEmail(evidence({},{headerFrom:'Alerts <no-reply@vendor.example>'})),{automatic:true,reasons:['no-reply']},'a no-reply header From only ever suppresses')
 assert.deepEqual(classifyInboundEmail(evidence({},{envelopeFrom:''})),{automatic:true,reasons:['null-sender']})
 const bounce=classifyInboundEmail(evidence({'Auto-Submitted':'auto-replied'},{envelopeFrom:'MAILER-DAEMON@example.com',subject:'Undeliverable: Help'}))
 assert.equal(bounce.automatic,true);assert.deepEqual(bounce.reasons.sort(),['auto-submitted','mailer-daemon','subject'])
})

test('the subject rule matches an autoresponder prefix and never a customer sentence',()=>{
 for(const subject of ['Automatic reply: My order is late','Out of Office: Re: ticket 12','Re: Automatic reply: hello','AW: Out of the office','Undeliverable: your message','Delivery Status Notification (Failure)','Mail delivery failed: returning message to sender','Returned mail: see transcript','Auto-Reply: away','Autoreply','Out of office']){
  assert.deepEqual(classifyInboundEmail(evidence({},{subject})),{automatic:true,reasons:['subject']},subject)
 }
 for(const subject of ['Out of office auto-replies are not working in my account','How do I set an automatic reply for my team?','Delivery status for order #4192 is still pending','Undeliverable orders keep showing in my dashboard','Re: my out of office question']){
  assert.deepEqual(classifyInboundEmail(evidence({},{subject})),{automatic:false,reasons:[]},subject)
 }
})

test('stored evidence keeps its reasons, parses, and drops threading headers first to stay bounded',()=>{
 const small=evidence({'Message-ID':'<a@example.com>'})
 assert.deepEqual(JSON.parse(evidenceJson(small,{automatic:false,reasons:[]})),{...small,reasons:[]})
 const quoted='"\\'.repeat(100)
 const worst=emailEvidence({envelopeFrom:'"'.repeat(320),headerFrom:'"'.repeat(320),subject:'"'.repeat(200),headers:EVIDENCE_HEADERS.map(key=>({key,value:quoted}))})
 const stored=evidenceJson(worst,{automatic:true,reasons:['auto-submitted','precedence']})
 assert.ok(stored.length<=MAX_EVIDENCE_JSON,'the stored evidence respects its bound')
 const parsed=JSON.parse(stored)
 assert.deepEqual(parsed.reasons,['auto-submitted','precedence'])
 assert.equal(parsed.headers['auto-submitted'],quoted,'what the classifier read survives longest')
 assert.equal(parsed.headers.references,undefined,'threading history is dropped first')
})

test('outbound notifications carry loop-suppression headers',()=>{
 assert.deepEqual(loopSuppressionHeaders({actor_role:'ai'}),{'Auto-Submitted':'auto-replied','X-Auto-Response-Suppress':'All'})
 assert.deepEqual(loopSuppressionHeaders({actor_role:'contact'}),{'Auto-Submitted':'auto-generated','X-Auto-Response-Suppress':'All'})
 assert.deepEqual(loopSuppressionHeaders({actor_role:'owner'}),{'Auto-Submitted':'auto-generated','X-Auto-Response-Suppress':'All'})
})
