import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {messageCitations} from '../src/modules/conversations/citations.js'
test('widget cited answer renders the canonical anchor, durable only',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'t021-widget-'))
 try{
  const file=join(dir,'components.mjs')
  await build({stdin:{contents:"export {default as Widget} from './src/modules/widget/js/ChatMessage.jsx';export {default as Inbox} from './src/ui/native/MessageCitations.jsx';export {default as Context} from './src/modules/widget/js/context/AppContext.jsx'",resolveDir:process.cwd()},bundle:true,outfile:file,format:'esm',platform:'node',packages:'external',logLevel:'silent'})
  // Resolve React from this checkout even though the generated module is outside it.
  const {execFileSync}=await import('node:child_process');execFileSync('ln',['-s',join(process.cwd(),'node_modules'),join(dir,'node_modules')])
  const {Widget,Inbox,Context}=await import(pathToFileURL(file))
  const message={id:'m',content:'Refund within 30 days.',citations_json:JSON.stringify([{id:'article:a',sourceVersion:'v',title:'Refund policy',url:'https://support.example/help/p/refunds'}])}
  const widget=m=>renderToStaticMarkup(React.createElement(Context.Provider,{value:{theme:{chat:{user:{},agent:{}}}}},React.createElement(Widget,{message:m})))
  for(const html of [widget(message),renderToStaticMarkup(React.createElement(Inbox,{message}))]){assert.match(html,/<a href="https:\/\/support.example\/help\/p\/refunds" target="_blank" rel="noopener noreferrer">Refund policy<\/a>/)}
  assert.doesNotMatch(widget({...message,id:undefined,chunked:true}),/Refund policy|<a /)
  assert.doesNotMatch(widget({...message,chunked:true,chunked_complete:false}),/Refund policy|<a /)
  assert.match(widget({...message,chunked:true,chunked_complete:true}),/<a href=/)
  assert.doesNotMatch(widget({...message,erased_at:1}),/Refund policy|<a /)
  assert.deepEqual(messageCitations({...message,citations_json:'invalid'}),[])
  assert.deepEqual(messageCitations({...message,citations:[{id:'article:x',title:'Attack',url:'javascript:alert(1)'}]}),[])
 }finally{await rm(dir,{recursive:true,force:true})}
})
