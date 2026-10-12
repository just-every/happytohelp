import {Buffer} from 'node:buffer'
/** Workers Paid D1 limits, shared by every operation in one invocation. */
export function boundedDatabase(db:D1Database,limit=1000){
 const metrics={statements:0,writes:0,maxSqlBytes:0,maxBindings:0,maxValueBytes:0,maxParameterBytes:0,maxDurationMs:0},raw=new WeakMap<object,D1PreparedStatement>(),queries=new WeakMap<object,string>()
 const consume=(count:number)=>{if(metrics.statements+count>limit)throw new Error('WORKER_D1_STATEMENT_LIMIT');metrics.statements+=count}
 const readOnly=(sql:string)=>/^\s*(SELECT|PRAGMA|EXPLAIN)\b/i.test(sql)
 function check(sql:string,params:unknown[]=[]){const sqlBytes=Buffer.byteLength(sql),sizes=params.map(value=>typeof value==='string'?Buffer.byteLength(value):value instanceof ArrayBuffer||ArrayBuffer.isView(value)?value.byteLength:8),maxValue=Math.max(0,...sizes),total=sizes.reduce((n,size)=>n+size,0);if(sqlBytes>100000||params.length>100)throw new Error('WORKER_D1_QUERY_LIMIT');if(maxValue>2000000||total>2000000)throw new Error('WORKER_D1_VALUE_LIMIT');metrics.maxSqlBytes=Math.max(metrics.maxSqlBytes,sqlBytes);metrics.maxBindings=Math.max(metrics.maxBindings,params.length);metrics.maxValueBytes=Math.max(metrics.maxValueBytes,maxValue);metrics.maxParameterBytes=Math.max(metrics.maxParameterBytes,total)}
 async function measured<T>(run:()=>Promise<T>){const start=performance.now();try{return await run()}finally{metrics.maxDurationMs=Math.max(metrics.maxDurationMs,performance.now()-start)}}
 function wrap(statement:D1PreparedStatement,query:string,params:unknown[]=[]):D1PreparedStatement{
  check(query,params)
  const execute=<T>(run:()=>Promise<T>)=>{consume(1);if(!readOnly(query))metrics.writes++;return measured(run)}
  const result={bind(...values:unknown[]){return wrap(statement.bind(...values),query,values)},first(...args:any[]){return execute(()=>(statement.first as any)(...args))},all(){return execute(()=>statement.all())},run(){return execute(()=>statement.run())},raw(...args:any[]){return execute(()=>(statement.raw as any)(...args))}} as D1PreparedStatement
  raw.set(result,statement);queries.set(result,query);return result
 }
 const database={prepare(sql:string){return wrap(db.prepare(sql),sql)},async batch(statements:D1PreparedStatement[]){consume(statements.length);metrics.writes+=statements.filter(s=>!readOnly(queries.get(s)||'')).length;return measured(()=>db.batch(statements.map(s=>raw.get(s)??s)))},async exec(){throw new Error('Unbounded D1 exec is unavailable in request handlers')},dump:()=>db.dump()} as unknown as D1Database
 return {database,get metrics(){return {...metrics}},get statements(){return metrics.statements},get writes(){return metrics.writes}}
}
