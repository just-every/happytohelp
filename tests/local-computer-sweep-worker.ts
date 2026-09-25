// Runs the edition's real scheduled tick so tests can prove one module's recovery never starves the ones after it.
import {runScheduled} from '../src/jobs';
import type {Env} from '../src/platform/env';
export default {async fetch(_request:Request,env:Env){
 try{await runScheduled(env);return Response.json({data:true});}
 catch(error){return Response.json({message:String(error)},{status:500});}
}};
