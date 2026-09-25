import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const output=process.argv[2];
if(!output)throw Error('Usage: node scripts/independent/source-snapshot.mjs /new/absolute/output-directory');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(git('status','--porcelain'))throw Error('Commit and review all source changes before making a distribution snapshot');
const revision=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
const entries=git('ls-tree','-r',revision).split('\n').map(line=>{const [metadata,path]=line.split('\t');return {mode:metadata.split(' ')[0],path}});
for(const entry of entries){
 if(!['100644','100755'].includes(entry.mode))throw Error(`Unsupported source entry: ${entry.path}`);
 if(entry.path.split('/').some(part=>/^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.npmrc|\.netrc|\.pypirc|\.seed|\.wrangler|node_modules)$/i.test(part)))throw Error(`Private source entry: ${entry.path}`);
}
const destination=resolve(output);await mkdir(destination,{recursive:false});
const archive=execFileSync('git',['archive','--format=tar',revision],{maxBuffer:256*1024*1024});
await writeFile(join(destination,'happytohelp-source.tar'),archive,{flag:'wx'});
const receipt={schema:1,revision,tree,archive:'happytohelp-source.tar',sha256:createHash('sha256').update(archive).digest('hex'),files:entries.length,historyIncluded:false,license:'MIT; retain docs/licenses and dependency notices',publication:'Not performed. Review the candidate and its evidence before publication.'};
await writeFile(join(destination,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt,null,2));
