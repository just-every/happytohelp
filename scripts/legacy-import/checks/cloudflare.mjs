import {d1Database} from '../target.mjs';

/** Message operations on the named queues between two times (Cloudflare GraphQL analytics). */
export async function queueOperations(api,{since,until,queues}){
  const all=await api.get('queues?per_page=100'),ids=queues.map(name=>{const queue=all.find(q=>q.queue_name===name);if(!queue)throw Error(`Queue ${name} was not found in this account`);return queue.queue_id;});
  const data=await api.graphql(`query($account:String!,$queues:[String!],$since:Time!,$until:Time!){viewer{accounts(filter:{accountTag:$account}){
    queueMessageOperationsAdaptiveGroups(limit:1000,filter:{queueId_in:$queues,datetime_geq:$since,datetime_leq:$until}){count dimensions{queueId actionType}}}}}`,{queues:ids,since,until});
  const operations=data.viewer.accounts[0].queueMessageOperationsAdaptiveGroups.map(g=>({queue:queues[ids.indexOf(g.dimensions.queueId)],action:g.dimensions.actionType,count:g.count}));
  return {since,until,queues,writes:operations.filter(o=>o.action==='WriteMessage').reduce((n,o)=>n+o.count,0),operations};
}

/** The D1 database's stored size, as Cloudflare reports it. */
export async function databaseSize(api,name){
  const d1=await d1Database(api,name),detail=await api.get(`d1/database/${d1.uuid}`);
  return {database:name,uuid:d1.uuid,bytes:detail.file_size,gigabytes:Math.round((detail.file_size||0)/1e6)/1e3,tables:detail.num_tables};
}
