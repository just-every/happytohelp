/** Test-only commit interposition over real D1; every statement still executes. */
export function raceDatabase(original:any,race:any[],match:string|undefined,skip=0){
 let fired=false,batches=0;const underlying=new WeakMap<object,any>(),sqls=new WeakMap<object,string>()
 async function inject(){if(fired)return;fired=true;for(const command of race)await original.prepare(command.sql).bind(...(command.params||[])).run()}
 function wrap(statement:any,sql:string):any{
  const proxy=new Proxy(statement,{get(target,key){
   if(key==='bind')return (...args:any[])=>wrap(target.bind(...args),sql)
   if(key==='run'||key==='first'||key==='all')return async(...args:any[])=>{if(match&&sql.includes(match))await inject();return target[key](...args)}
   const value=target[key];return typeof value==='function'?value.bind(target):value
  }});underlying.set(proxy,statement);sqls.set(proxy,sql);return proxy
 }
 return new Proxy(original,{get(target,key){
  if(key==='prepare')return (sql:string)=>wrap(target.prepare(sql),sql)
  if(key==='batch')return async(statements:any[])=>{if(match?statements.some(s=>sqls.get(s)?.includes(match)):batches++>=skip)await inject();return target.batch(statements.map(s=>underlying.get(s)||s))}
  const value=target[key];return typeof value==='function'?value.bind(target):value
 }})
}
