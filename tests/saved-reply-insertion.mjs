// Choosing a saved reply never discards or splits the typed draft.
import assert from 'node:assert/strict'
import {insertSavedReply} from '../src/ui/dashboard/utils/insertSavedReply.js'

const reply='Hi there, thanks for getting in touch!'
assert.deepEqual(insertSavedReply('',reply),{text:reply,caret:reply.length},'an empty composer becomes exactly the reply')
assert.deepEqual(insertSavedReply('  \n ',reply),{text:reply,caret:reply.length},'a blank composer becomes exactly the reply')

const draft='Draft that must not be sent'
let result=insertSavedReply(draft,reply)
assert.equal(result.text,`${draft}\n\n${reply}`,'with the caret at the end the reply is appended as a new paragraph')
assert.equal(result.caret,result.text.length)
assert.equal(insertSavedReply(draft,reply,draft.length,draft.length).text,`${draft}\n\n${reply}`)

result=insertSavedReply(draft,reply,6)
assert.equal(result.text,`${draft}\n\n${reply}`,'a caret inside a line does not split the line: the reply follows it')
assert.ok(result.text.includes(draft),'the draft stays contiguous')
assert.equal(result.text.slice(result.caret-reply.length,result.caret),reply,'the caret lands right after the inserted reply')

result=insertSavedReply(draft,reply,0)
assert.equal(result.text,`${reply}\n\n${draft}`,'a caret at the very start puts the reply before the draft')
assert.equal(result.caret,reply.length)

result=insertSavedReply('First line\nSecond line',reply,'First line\n'.length)
assert.equal(result.text,`First line\n\n${reply}\n\nSecond line`,'a caret at the start of a line puts the reply before that line')
result=insertSavedReply('First line\nSecond line',reply,'First l'.length)
assert.equal(result.text,`First line\n\n${reply}\n\nSecond line`,'a caret inside a line puts the reply after that line')

result=insertSavedReply('Hello XXX world',reply,'Hello '.length,'Hello XXX'.length)
assert.ok(result.text.includes('Hello XXX world'),'a selection is not overwritten')

assert.equal(insertSavedReply(`${draft}\n`,reply).text,`${draft}\n\n${reply}`,'an existing trailing newline is not doubled')
assert.equal(insertSavedReply(`${draft}\n\n`,reply).text,`${draft}\n\n${reply}`)
assert.equal(insertSavedReply(draft,reply,999,999).text,`${draft}\n\n${reply}`,'an out-of-range caret is clamped')
for(const [text,start,end] of [[draft,5,5],[draft,0,draft.length],['a\nb',2,2],['a\n\nb',1,1]]){const out=insertSavedReply(text,reply,start,end);assert.ok(out.text.includes(reply));for(const line of text.split('\n').filter(Boolean))assert.ok(out.text.includes(line))}
console.log('Saved reply insertion: empty draft replaced, typed draft kept whole, caret handling passed')
