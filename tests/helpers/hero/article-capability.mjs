import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
// Harness-only capability transport: authenticated native REST, never simulated state.
// Holds the owner cookie in memory; exposes exactly one existing article and one publication.
export async function articleCapability({origin,cookie,projectId,article}){
 const token=randomBytes(32).toString('hex'),receipts=[];let attempted=false;
 const path=`/api/knowledge/${projectId}/articles`,publicPath=`/api/knowledge/public/${projectId}/articles/${article.slug}`;
 const server=createServer(async(req,res)=>{try{
  res.setHeader('Content-Type','application/json');
  if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(403);res.end('{}');return;}
  if(req.url==='/article'&&req.method==='GET'){res.end(JSON.stringify({article,publicUrl:origin+`/help/${projectId}/${article.slug}`,publicApiUrl:origin+publicPath}));return;}
  if(req.url!=='/publish'||req.method!=='POST'){res.writeHead(404);res.end('{}');return;}
  if(attempted){res.writeHead(409);res.end(JSON.stringify({error:'Publication already attempted; read public result, never repeat'}));return;}
  let text='';for await(const chunk of req){text+=chunk;if(text.length>2048)throw Error('Request too large');}
  const data=JSON.parse(text);if(Object.keys(data).length!==1||data.articleId!==article.id){res.writeHead(403);res.end('{}');return;}
  // Body reads yield: recheck and reserve together before any outbound await.
  if(attempted){res.writeHead(409);res.end(JSON.stringify({error:'Publication already attempted; read public result, never repeat'}));return;}
  attempted=true;const startedAt=new Date().toISOString();
  const result=await fetch(origin+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({...article,status:'published'}),redirect:'manual',signal:AbortSignal.timeout(30000)});
  const body=await result.json();receipts.push({startedAt,method:'POST',nativePath:path,articleId:article.id,status:result.status});
  res.writeHead(result.status);res.end(JSON.stringify(body));
 }catch{receipts.push({outcome:'unknown; never replay'});res.writeHead(502);res.end(JSON.stringify({error:'Outcome unknown; inspect public state, no repeat'}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return{base:`http://127.0.0.1:${server.address().port}`,token,receipts,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
