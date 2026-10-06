import assert from 'node:assert/strict';
import {createServer} from 'node:http';

// Only external provider HTTP is replaced. App routes, D1, R2 and UI remain real.
export async function providerFixture({port}){
 const state={modelStatus:200,modelBody:{id:'gpt-5-mini',object:'model'},dns:'pending',mailEvent:'queued',sendStatus:200,sendCalls:0,calls:[],messages:new Map()};
 const server=createServer(async(request,response)=>{
  const url=new URL(new URL(request.url,'http://fixture.test').searchParams.get('provider'));state.calls.push({method:request.method,url:url.href});
  const json=(value,status=200)=>{response.writeHead(status,{'Content-Type':'application/json'});response.end(JSON.stringify(value));};
  try{
   if(url.hostname==='api.openai.com'&&url.pathname==='/v1/models/gpt-5-mini'){assert.equal(request.method,'GET');assert.equal(request.headers.authorization,'Bearer activation-inert-model-key');return json(state.modelBody,state.modelStatus);}
   if(url.hostname!=='api.resend.com')throw new Error('Unexpected provider '+url);
   assert.equal(request.headers.authorization,'Bearer activation-inert-mail-key');
   if(url.pathname==='/domains')return json({data:[{id:'activation-domain',name:'activation.example.test'}],has_more:false});
   if(url.pathname==='/domains/activation-domain')return json({id:'activation-domain',name:'activation.example.test',status:state.dns,records:[{record:'SPF',status:state.dns},{record:'DKIM',status:state.dns}]});
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
