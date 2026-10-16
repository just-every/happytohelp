import {useEffect, useState} from 'react';
import {nativeRequest} from '../../transport';

export function useArticleSearch(projectId, section, items, query) {
 const keyword=query.trim();
 const path=section==='articles'&&keyword
  ? `/api/knowledge/${encodeURIComponent(projectId)}/articles?q=${encodeURIComponent(keyword)}`
  : '';
 const [result,setResult]=useState(null);

 useEffect(()=>{
  if(!path){setResult(null);return;}
  let active=true;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   try {
    const response=await nativeRequest(path,{signal:controller.signal});
    if(active)setResult({path,source:items,items:response.data||response});
   } catch(error) {
    if(active)setResult({path,source:items,error:error.message});
   }
  },250);
  return ()=>{active=false;clearTimeout(timer);controller.abort();};
 },[path,items]);

 if(!path)return {rows:items,loading:false,error:''};
 if(result?.path!==path||result.source!==items)return {rows:[],loading:true,error:''};
 return {rows:result.items||[],loading:false,error:result.error||''};
}
