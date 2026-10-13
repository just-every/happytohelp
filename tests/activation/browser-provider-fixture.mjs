import assert from 'node:assert/strict';
import {createServer} from 'node:http';

// Resend's domain detail lists each DNS record with its public name, type, value and status.
export const domainRecords=status=>[{record:'SPF',name:'send',type:'MX',value:'feedback-smtp.example-region.amazonses.com',priority:10,status},{record:'SPF',name:'send',type:'TXT',value:'v=spf1 include:amazonses.com ~all',status},{record:'DKIM',name:'resend._domainkey',type:'TXT',value:'p=MIGfMA0GCSqGSIb3DQEB',status}];

// Only external provider HTTP is replaced. App routes, D1, R2 and UI remain real.
export async function providerFixture({port}){
 const state={modelStatus:200,modelBody:{id:'gpt-5-mini',object:'model'},dns:'pending',mailEvent:'queued',sendStatus:200,sendCalls:0,calls:[],messages:new Map()};
 const server=createServer(async(request,response)=>{
  const url=new URL(new URL(request.url,'http://fixture.test').searchParams.get('provider'));state.calls.push({method:request.method,url:url.href});
  const json=(value,status=200)=>{response.writeHead(status,{'Content-Type':'application/json'});response.end(JSON.stringify(value));};
  try{
   if(url.hostname==='api.openai.com'&&url.pathname==='/v1/models/gpt-5-mini'){assert.equal(request.method,'GET');assert.equal(request.headers.authorization,'Bearer activation-inert-model-key');if(state.modelGate)await state.modelGate;return json(state.modelBody,state.modelStatus);}
   if(url.hostname==='cloudflare-dns.com'&&url.pathname==='/dns-query'){
    assert.equal(request.method,'GET');const name=url.searchParams.get('name');
    assert.ok(['activation.example.test','resend._domainkey.activation.example.test','_dmarc.activation.example.test'].includes(name));
    const value=name.startsWith('_dmarc.')?'v=DMARC1; p=none':name.includes('._domainkey.')?'v=DKIM1; p=fixture-public-key':'v=spf1 ~all';
    return json({Status:0,Answer:[{type:16,data:JSON.stringify(value)}]});
   }
   if(url.hostname!=='api.resend.com')throw new Error('Unexpected provider '+url);
   assert.equal(request.headers.authorization,'Bearer activation-inert-mail-key');
   if(url.pathname==='/domains')return json({data:[{id:'activation-domain',name:'activation.example.test'}],has_more:false});
   if(url.pathname==='/domains/activation-domain')return json({id:'activation-domain',name:'activation.example.test',status:state.dns,records:domainRecords(state.dns)});
   if(url.pathname==='/emails'&&request.method==='POST'){
    state.sendCalls++;let text='';for await(const chunk of request)text+=chunk;const body=JSON.parse(text);assert.deepEqual(body.to,['activation-browser@example.test']);assert.equal(body.headers['Auto-Submitted'],'auto-generated');assert.equal(body.headers['X-Auto-Response-Suppress'],'All');
    if(state.sendStatus!==200)return json({error:'uncertain transport fixture'},state.sendStatus);
    const id='activation-provider-mail-'+state.sendCalls;state.messages.set(id,body);return json({id});
   }
   if(url.pathname.startsWith('/emails/')){const id=url.pathname.split('/').pop(),message=state.messages.get(id);assert.ok(message,'status request joins actual fixture send ID');return json({id,to:message.to,from:message.from,last_event:state.mailEvent});}
   throw new Error('Unexpected fixture request '+url);
  }catch(error){state.error=error.message;json({error:error.message},599);}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
 return {state,origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
