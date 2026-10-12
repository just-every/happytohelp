import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {messageCitations,visibleMessageContent} from '../src/modules/conversations/citations.js'
test('widget cited answer renders the canonical anchor, durable only',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'t021-widget-'))
 try{
  const file=join(dir,'components.cjs')
  await build({stdin:{contents:"export {default as Widget} from './src/modules/widget/js/ChatMessage.jsx';export {default as Inbox} from './src/ui/native/MessageCitations.jsx';export {default as Operator} from './src/ui/dashboard/components/MessageItem.jsx';export {default as Context} from './src/modules/widget/js/context/AppContext.jsx'",resolveDir:process.cwd()},bundle:true,outfile:file,format:'cjs',platform:'node',external:['react','react-dom'],loader:{'.scss':'empty'},logLevel:'silent'})
  // Share this checkout's React with the renderer; bundle package subpaths for Node.
  const {execFileSync}=await import('node:child_process');execFileSync('ln',['-s',join(process.cwd(),'node_modules'),join(dir,'node_modules')])
  const {Widget,Inbox,Operator,Context}=await import(pathToFileURL(file))
  const markerId='render-test-article'
  const marker=`\uE200cite\uE202article:${markerId}\uE201`
  const content=`Refund within 30 days. ${marker}\n\nRead article:guide-42 with **Markdown emphasis**.`
  const citationsJson=JSON.stringify([{id:'article:a',sourceVersion:'v',title:'Refund policy',url:'https://support.example/help/p/refunds'}])
  const message={id:'m',created_at:'2026-10-12T00:00:00.000Z',content,citations_json:citationsJson}
  const widget=m=>renderToStaticMarkup(React.createElement(Context.Provider,{value:{theme:{chat:{user:{},agent:{}}}}},React.createElement(Widget,{message:m})))
  const widgetHtml=widget(message)
  const inboxHtml=renderToStaticMarkup(React.createElement(Inbox,{message}))
  const operatorHtml=renderToStaticMarkup(React.createElement(Operator,{message}))
  const canonicalAnchor=/<a href="https:\/\/support.example\/help\/p\/refunds" target="_blank" rel="noopener noreferrer">Refund policy<\/a>/
  for(const html of [widgetHtml,inboxHtml,operatorHtml])assert.match(html,canonicalAnchor)
  for(const html of [widgetHtml,operatorHtml]){
   assert.match(html,/Refund within 30 days\./)
   assert.match(html,/article:guide-42/)
   assert.match(html,/<strong>Markdown emphasis<\/strong>/)
   assert.doesNotMatch(html,/\uE200|\uE201|\uE202/)
   assert.equal(html.includes(`article:${markerId}`),false)
  }
  assert.equal(message.content,content)
  assert.equal(message.citations_json,citationsJson)
  const partial=widget({...message,content:`Refund within 30 days. ${marker.slice(0,-1)}`,chunked:true,chunked_complete:false})
  assert.match(partial,/Refund within 30 days\./)
  assert.doesNotMatch(partial,/\uE200|\uE201|\uE202/)
  assert.equal(partial.includes(`article:${markerId}`),false)
  assert.doesNotMatch(partial,/Refund policy|<a /)
  assert.equal(visibleMessageContent(`Read article:guide-42. ${marker}`),'Read article:guide-42. ')
  assert.doesNotMatch(widget({...message,id:undefined,chunked:true}),/Refund policy|<a /)
  assert.doesNotMatch(widget({...message,chunked:true,chunked_complete:false}),/Refund policy|<a /)
  assert.match(widget({...message,chunked:true,chunked_complete:true}),/<a href=/)
  assert.doesNotMatch(widget({...message,erased_at:1}),/Refund policy|<a /)
  assert.deepEqual(messageCitations({...message,citations_json:'invalid'}),[])
  assert.deepEqual(messageCitations({...message,citations:[{id:'article:x',title:'Attack',url:'javascript:alert(1)'}]}),[])
 }finally{await rm(dir,{recursive:true,force:true})}
})
