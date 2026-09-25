export type Row=Record<string,unknown>
export interface LegacyBundle {format:'happytohelp-legacy-v1';source:{repository:string;revision:string;exportedAt:string;[key:string]:unknown};tables:Record<string,Row[]>;objects?:{key:string;dataBase64:string;sha256:string}[]}
export interface MappedRow {table:string;row:Row;key:string[];hold?:string}
export function stable(value:unknown):string {if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stable).join(',')+']';return '{'+Object.keys(value as Row).sort().map(key=>JSON.stringify(key)+':'+stable((value as Row)[key])).join(',')+'}'}
export async function digest(value:string|Uint8Array){const bytes=typeof value==='string'?new TextEncoder().encode(value):value;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export function timestamp(value:unknown){if(value===undefined||value===null)return 0;if(typeof value==='number')return value;const parsed=Date.parse(String(value));if(!Number.isFinite(parsed))throw new Error(`Invalid legacy timestamp: ${value}`);return parsed}
export function text(value:unknown,field:string){if(value===undefined||value===null||String(value)==='')throw new Error(`Required legacy field missing: ${field}`);return String(value)}
