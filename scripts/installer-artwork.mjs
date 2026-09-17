#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { validatePng } from './installer/workspace-art.mjs';
if(process.argv.includes('--help')){console.log('Inspect or finish website-derived workspace sidebar artwork.\nnode scripts/installer-artwork.mjs --url ORIGIN --session SESSION --inspect\nnode scripts/installer-artwork.mjs --url ORIGIN --session SESSION --job ID --revision N --status generating --brief /absolute/site-brief.json | --status error\nnode scripts/installer-artwork.mjs --url ORIGIN --session SESSION --job ID --revision N --image /absolute/artwork.png\nClaim generating before making one provider request. Never automatically replay generation. Upload the actual generated PNG; no URL or browser filesystem input is accepted.');process.exit(0);}
const input={};for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(key==='--inspect')input.inspect=true;else if(['--url','--session','--job','--revision','--status','--image','--brief'].includes(key))input[key.slice(2)]=process.argv[++i];else throw Error('Use --help for supported options.');}
const target=new URL(input.url);if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.search||target.hash||target.pathname!=='/')throw Error('Use the exact loopback installer origin.');
if(!input.session)throw Error('Supply the expected session from the installer handoff.');
const page=await fetch(target,{redirect:'error'}),html=await page.text();
const token=html.match(/name="installer-token" content="([a-f0-9]+)"/)?.[1],cookie=page.headers.get('set-cookie')?.split(';')[0];if(!page.ok||!token||!cookie)throw Error('Not a compatible installer.');
const headers={'X-Installer-Token':token,Cookie:cookie,Origin:target.origin};
const response=await fetch(new URL('/api/state',target),{headers,redirect:'error'});if(!response.ok)throw Error('Cannot inspect installer.');const state=await response.json();if(state.sessionId!==input.session)throw Error('Installer session changed. Get a fresh handoff.');
if(input.inspect)console.log(JSON.stringify({sessionId:state.sessionId,workspaceArt:state.workspaceArt||null,workspaceArtTransfer:state.workspaceArtTransfer||null},null,2));
if(input.status||input.image){
 if(!input.job||!/^\d+$/.test(input.revision||''))throw Error('Supply the inspected job ID and revision.');
 let path,body;
 if(input.image){path='/api/workspace-art/image';body=validatePng(await readFile(input.image));headers['Content-Type']='image/png';headers['X-Artwork-Job']=input.job;headers['X-Artwork-Revision']=input.revision;headers['X-Installer-Session']=input.session;}
 else {path='/api/workspace-art/job';headers['Content-Type']='application/json';body=JSON.stringify({id:input.job,revision:Number(input.revision),sessionId:input.session,phase:input.status,...(input.brief?{siteBrief:JSON.parse(await readFile(input.brief,'utf8'))}:{})});}
 const result=await fetch(new URL(path,target),{method:'POST',headers,body,redirect:'error'}),value=await result.json();if(!result.ok)throw Error(value.error||'Workspace artwork update rejected.');console.log(JSON.stringify(value,null,2));
}else if(!input.inspect)throw Error('Choose --inspect, --status or --image.');
