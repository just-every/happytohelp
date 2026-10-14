import type {SourceRecord} from '../../import-kit/src/types'
import {object,sourceId,time,text} from './common'
/** Inbox's conversation.threads excludes notes and unpublished threads. Only
 * endpoint page receipts establish that the private/draft pages were supplied. */
export function helpScoutHistory(conversation:any,records:SourceRecord[],diagnostics:any[]){
 const id=sourceId(conversation.id,'helpscout'),pages=records.filter(r=>r.kind==='thread-page'&&r.sourceId.split(':')[0]===id)
 if(!pages.length)throw new Error('thread_pages_required_embedded_history_not_complete')
 if(diagnostics.some(d=>d.code==='conflicting_duplicate_id'&&d.kind==='thread-page'&&d.sourceId.startsWith(`${id}:`)))throw new Error('conflicting_thread_pages')
 const ordered=pages.map(r=>r.payload as any).sort((a,b)=>a.page.number-b.page.number),first=ordered[0].page
 if(!Number.isSafeInteger(first.totalPages)||first.totalPages<1||ordered.length!==first.totalPages)throw new Error('thread_pages_incomplete')
 const threads:any[]=[],seen=new Set<string>()
 ordered.forEach((entry,index)=>{
  const p=entry.page,items=entry._embedded?.threads
  if(!object(p)||![p.number,p.size,p.totalPages,p.totalElements].every(n=>Number.isSafeInteger(n)&&n>=0)||p.size<1||p.number!==index+1||p.totalPages!==first.totalPages||p.totalElements!==first.totalElements||!Array.isArray(items)||items.length>p.size)throw new Error('thread_pagination_invalid')
  const self=new URL(entry._links?.self?.href),next=entry._links?.next
  if([...self.searchParams.keys()].some(key=>key!=='page')||self.searchParams.getAll('page').length>1||self.hash||self.username||self.password)throw new Error('thread_page_scope_invalid')
  if(self.origin!=='https://api.helpscout.net'||self.pathname!==`/v2/conversations/${id}/threads`||(self.searchParams.get('page')??'1')!==String(p.number))throw new Error('thread_page_scope_invalid')
  if(index<ordered.length-1){if(!object(next)||typeof next.href!=='string')throw new Error('thread_next_page_missing');const url=new URL(next.href);if(url.origin!==self.origin||url.pathname!==self.pathname||url.searchParams.get('page')!==String(p.number+1)||[...url.searchParams.keys()].some(key=>key!=='page')||url.searchParams.getAll('page').length!==1||url.hash||url.username||url.password)throw new Error('thread_next_page_invalid')}
  else if(next!==undefined)throw new Error('thread_terminal_page_missing')
  for(const item of items){if(!object(item))throw new Error('thread_invalid');const sid=sourceId(item.id,'helpscout');if(seen.has(sid))throw new Error('duplicate_thread_id');seen.add(sid);threads.push(item)}
 })
 if(threads.length!==first.totalElements)throw new Error('thread_total_incomplete')
 if(!Number.isSafeInteger(conversation.threads)||conversation.threads<0||threads.filter(t=>t.state==='published'&&t.type!=='note').length!==conversation.threads)throw new Error('published_non_note_thread_count_mismatch')
 return threads.sort((a,b)=>time(a.createdAt,'iso')-time(b.createdAt,'iso')||String(a.id).localeCompare(String(b.id)))
}
export function helpScoutCustomer(payload:any){
 if(payload.draft!==undefined&&payload.draft!==false)throw new Error('draft_customer_not_imported')
 if([payload.firstName,payload.lastName].some(value=>value!==undefined&&typeof value!=='string'))throw new Error('customer_name_invalid')
 const emails=payload._embedded?.emails
 if(!Array.isArray(emails)||emails.length!==1||!object(emails[0])||typeof emails[0].value!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emails[0].value))throw new Error('one_customer_email_required')
 const email=emails[0].value,name=[payload.firstName,payload.lastName].filter(v=>typeof v==='string'&&v.trim()).join(' ')
 return {email,name:name||email,created:time(payload.createdAt,'iso')}
}
export function helpScoutArticleStatus(p:any,records:Map<string,SourceRecord>){
 if(!['published','notpublished'].includes(p.status)||typeof p.hasDraft!=='boolean')throw new Error('article_publication_required')
 const collection=records.get(`collection/${sourceId(p.collectionId,'helpscout')}`)?.payload as any
 if(!collection||!['public','private'].includes(collection.visibility))throw new Error('article_collection_visibility_unknown')
 if(!Array.isArray(p.categories))throw new Error('article_categories_required')
 if(new Set(p.categories.map((id:any)=>sourceId(id,'helpscout'))).size!==p.categories.length)throw new Error('article_category_duplicate')
 let privateAncestor=collection.visibility==='private'
 for(const categoryId of p.categories){const category=records.get(`category/${sourceId(categoryId,'helpscout')}`)?.payload as any;if(!category||String(category.collectionId)!==String(p.collectionId)||!['public','private'].includes(category.visibility))throw new Error('article_category_visibility_unknown');privateAncestor ||= category.visibility==='private'}
 // A detail with a draft query cannot masquerade as the published version.
 const href=p._links?.self?.href
 if(href!==undefined&&new URL(href).searchParams.get('draft')==='true')throw new Error('article_draft_body_requires_separate_group')
 text(p.text,'article_body_required');return p.status==='published'&&!privateAncestor&&!p.hasDraft?'published':'draft'
}
