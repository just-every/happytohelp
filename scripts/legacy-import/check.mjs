#!/usr/bin/env node
// Read-only checks after a package import into a deployed installation. Each prints one JSON
// object of counts, ids, digests and sizes, never content, and writes nothing anywhere.
import {remoteTarget,cloudflareApi} from './target.mjs';
import {countRows,countWork} from './checks/rows.mjs';
import {verifyAttachments} from './checks/attachments.mjs';
import {queueOperations,databaseSize} from './checks/cloudflare.mjs';
import {mailActivity} from './checks/mail.mjs';

const usage=`Usage: node scripts/legacy-import/check.mjs CHECK [options]
  rows --package DIR --database D1 --bucket R2 [--exclude-table TABLE ...]   journal and canonical counts against the package
  attachments --package DIR --database D1 --bucket R2                      every attachment's R2 bytes against the package
  work --database D1 --bucket R2                                           side-effect tables (outbox, mail, notifications, jobs, leads)
  queues --since ISO --until ISO --queue NAME [--queue NAME ...]           queue message operations in a window
  mail --since ISO --until ISO [--fleet-domain DOMAIN]                     SendGrid activity of every sender in a window
  size --database D1                                                       the D1 database's stored size`;
const [check,...args]=process.argv.slice(2),value=name=>{const i=args.indexOf(name);if(i<0)return undefined;const v=args[i+1];if(!v||v.startsWith('--'))throw Error(usage);return v;},all=name=>args.flatMap((a,i)=>a===name?[args[i+1]]:[]);
const required=name=>value(name)??(()=>{throw Error(usage);})();
const withTarget=async run=>{const target=await remoteTarget({database:required('--database'),bucket:required('--bucket')});try{return await run(target);}finally{await target.close();}};
const checks={
  rows:()=>withTarget(target=>countRows(target,required('--package'),{excludeTables:all('--exclude-table')})),
  attachments:()=>withTarget(target=>verifyAttachments(target,required('--package'))),
  work:()=>withTarget(countWork),
  queues:()=>queueOperations(cloudflareApi(),{since:required('--since'),until:required('--until'),queues:all('--queue')}),
  mail:()=>mailActivity({since:required('--since'),until:required('--until'),fleetDomain:value('--fleet-domain')??'runeditrun.com'}),
  size:()=>databaseSize(cloudflareApi(),required('--database')),
};
if(!Object.hasOwn(checks,check))throw Error(usage);
console.log(JSON.stringify({check,at:new Date().toISOString(),...await checks[check]()},null,2));
