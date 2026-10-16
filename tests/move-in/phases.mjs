import assert from 'node:assert/strict';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';

// Move in scenarios through the real import door, registered by their module and
// run by the journey that owns their claim. Every scenario belongs to exactly one journey.
export const registry=[];
export function phases(url){const file=basename(fileURLToPath(url),'.mjs');return (name,fn)=>{assert.equal(typeof fn,'function',name);registry.push({file,name,fn})}}
export async function runPhases(selected){
 assert.ok(selected.length,'a journey owns scenarios');
 for(const phase of selected){try{await phase.fn()}catch(error){if(error&&typeof error==='object')error.message=`${phase.file}: ${phase.name}: ${error.message}`;throw error}}
}
