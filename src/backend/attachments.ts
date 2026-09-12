import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from './types';
import { id,now } from './types';
import { scopedJob,liveGrant } from './agent-session';

export const agentAttachments=new Hono<Env>();
agentAttachments.post('/jobs/:id/attachments',async c=>{
  const runId=c.req.query('runId')??'';const job=await scopedJob(c,runId);
  const type=c.req.header('content-type')?.split(';')[0];
  if(!type||!['image/png','image/jpeg','image/gif'].includes(type))throw new HTTPException(415,{message:'PNG, JPEG or GIF required'});
  const reader=c.req.raw.body?.getReader();if(!reader)throw new HTTPException(400,{message:'Image body required'});
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>4*1024*1024){await reader.cancel();throw new HTTPException(413,{message:'Image exceeds 4 MiB'});}chunks.push(next.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const valid=type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:['GIF87a','GIF89a'].includes(new TextDecoder().decode(bytes.slice(0,6)));
  if(!valid)throw new HTTPException(400,{message:'Image bytes do not match declared type'});
  const attachmentId=id();
  const statements=[c.env.DB.prepare(`INSERT INTO attachments(id,job_id,run_id,agent_id,content_type,bytes,created_at) SELECT ?,id,run_id,agent_id,?,?,? FROM jobs WHERE id=? AND run_id=? AND agent_id=? AND status='running' AND lease_expires_at>? AND ${liveGrant}`).bind(attachmentId,type,new Uint8Array(0).buffer,now(),job.id,runId,c.get('agent').id,now())];
  for(let start=0,ordinal=0;start<bytes.length;start+=1024*1024,ordinal++) statements.push(c.env.DB.prepare('INSERT INTO attachment_chunks(attachment_id,ordinal,bytes) SELECT id,?,? FROM attachments WHERE id=?').bind(ordinal,bytes.slice(start,start+1024*1024).buffer,attachmentId));
  await c.env.DB.batch(statements);
  const row=await c.env.DB.prepare('SELECT id FROM attachments WHERE id=?').bind(attachmentId).first();
  if(!row)throw new HTTPException(409,{message:'Assignment is not active'});return c.json({attachmentId,contentType:type,size:length},201);
});
export const operatorAttachments=new Hono<Env>();
operatorAttachments.get('/attachments/:id',async c=>{
  const row=await c.env.DB.prepare('SELECT content_type,bytes FROM attachments WHERE id=?').bind(c.req.param('id')).first<{content_type:string;bytes:ArrayBuffer|number[]}>();
  if(!row)throw new HTTPException(404,{message:'Attachment not found'});
  const chunks=(await c.env.DB.prepare('SELECT bytes FROM attachment_chunks WHERE attachment_id=? ORDER BY ordinal').bind(c.req.param('id')).all<{bytes:ArrayBuffer|number[]}>()).results.map(chunk=>new Uint8Array(chunk.bytes));
  const content=new Uint8Array(chunks.reduce((size,chunk)=>size+chunk.byteLength,0));let position=0;for(const chunk of chunks){content.set(chunk,position);position+=chunk.byteLength;}
  return new Response(content,{headers:{'content-type':row.content_type,'content-disposition':'inline','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
});
