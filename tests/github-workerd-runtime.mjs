import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createServer} from 'node:http'

const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('wrangler')]}))
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}))

let fixtureCalls=0
const fixture=createServer((request,response)=>{
 fixtureCalls+=1
 if(fixtureCalls===1){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({id:1378012333,full_name:'fixture/repo',private:true,default_branch:'main'}));return}
 response.writeHead(302,{Location:'https://github.com/elsewhere'});response.end()
})
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve))
const port=fixture.address().port
const origin=`http://127.0.0.1:${port}`
const root=new URL('..',import.meta.url).pathname
const bundled=await build({
 stdin:{
  contents:`
import {listGithubRepositories} from './src/modules/integrations/github-discovery.ts'
const nativeFetch=globalThis.fetch
globalThis.fetch=(input,init)=>nativeFetch(${JSON.stringify(origin)}+new URL(input).pathname,init)
export default {async fetch(){
 const env={DB:{prepare(){return {bind(){return {first:async()=>({repositories_json:'["fixture/repo"]'})}}}}}}
 const success=await listGithubRepositories(env,'project',{mode:'mapped',token:'fixture-token'})
 let rejected
 try{await listGithubRepositories(env,'project',{mode:'mapped',token:'fixture-token'})}
 catch(error){rejected={status:error.status,message:error.message}}
 return Response.json({success,rejected})
}}
`,
  resolveDir:root,
 },
 bundle:true,
 write:false,
 format:'esm',
 platform:'browser',
 target:'es2022',
 logLevel:'silent',
})
const runtime=new Miniflare(convertV4MiniflareOptions({
 name:'h2h-github-workerd-runtime',
 modules:true,
 script:bundled.outputFiles[0].text,
 compatibilityDate:'2026-09-08',
 compatibilityFlags:['nodejs_compat'],
}))
try{
 const response=await runtime.dispatchFetch('https://github-runtime.test/')
 const result=await response.json()
 assert.equal(response.status,200,JSON.stringify(result))
 assert.deepEqual(result.success,[{id:1378012333,full_name:'fixture/repo',private:true,default_branch:'main'}])
 assert.equal(result.rejected.status,502)
 assert.match(result.rejected.message,/GitHub HTTP 302/)
 assert.equal(fixtureCalls,2)
 console.log('GitHub workerd transport: real mapped discovery reached a local provider fixture and rejected a redirect response.')
}finally{
 await runtime.dispose()
 await new Promise(resolve=>fixture.close(resolve))
}
