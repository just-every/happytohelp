import { execFile } from 'node:child_process';
import { derivePrefix } from './ui/model.mjs';
import { installationReceipt } from './private.mjs';
import { wranglerCredentials, assertProductionCloudflare } from './wrangler-auth.mjs';
export { derivePrefix } from './ui/model.mjs';

export async function assertWorkerAvailable(root, input, {env=process.env,run=privateCommand,fetch:request=globalThis.fetch}={}) {
  if(typeof input.accountId!=='string'||!/^[a-f0-9]{32}$/i.test(input.accountId)||typeof input.prefix!=='string'||!/^[a-z][a-z0-9-]{2,39}$/.test(input.prefix))throw invalid('Choose a valid Cloudflare account and resource name.');
  let receipt;try{receipt=await installationReceipt(root,input.appOrigin,{accountId:input.accountId,prefix:input.prefix});}catch{throw new AddressError('receipt_scope','The saved installation receipt does not confirm ownership of this Cloudflare Worker. Preserve it and verify the existing installation before continuing.');}
  if(receipt?.deployed===true)return;
  const headers=await authorization(root,input.apiToken,env,run);
  let response;try{response=await request(`https://api.cloudflare.com/client/v4/accounts/${input.accountId}/workers/scripts/${input.prefix}/settings`,{headers,signal:AbortSignal.timeout(12000),redirect:'error'});}catch{throw new AddressError('cloudflare_unavailable','Cloudflare could not check whether this workspace address is already used. Try again.');}
  if(response.status===404)return;
  if(response.ok)throw new AddressError('name_in_use','This Cloudflare workspace name is already used. Change your workspace name or choose a different resource name in advanced settings.');
  if(response.status===401||response.status===403)throw new AddressError('cloudflare_permission','Cloudflare could not check this Worker. Reconnect or provide a token with Workers Scripts Read permission.');
  throw new AddressError('cloudflare_unavailable','Cloudflare could not check whether this workspace address is already used. Try again.');
}

export class AddressError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const invalid = message => new AddressError('invalid_input', message);
const privateCommand = (file, args, options) => new Promise((resolve, reject) => {
  execFile(file, args, { ...options, timeout: 12000, maxBuffer: 16384 }, (error, stdout) => error ? reject(new Error('Authentication unavailable')) : resolve(stdout));
});
async function authorization(root, apiToken, env, run) {
  try{assertProductionCloudflare(env)}catch{throw new AddressError('cloudflare_environment','This installer requires the standard Cloudflare production API. Remove the alternate Cloudflare environment or API address setting before continuing.');}
  const token = apiToken || env.CLOUDFLARE_API_TOKEN;
  if (token) return { Authorization: `Bearer ${token}` };
  try {
    const credentials = await wranglerCredentials(root, env, run);
    if (['oauth', 'api_token'].includes(credentials.type) && typeof credentials.token === 'string' && credentials.token.trim()) return { Authorization: `Bearer ${credentials.token}` };
    if (credentials.type === 'api_key' && typeof credentials.key === 'string' && typeof credentials.email === 'string') return { 'X-Auth-Key': credentials.key, 'X-Auth-Email': credentials.email };
  } catch {}
  throw new AddressError('cloudflare_auth', 'Cloudflare sign-in could not provide a usable credential. Reconnect, update Wrangler, or provide an API token to find your app address.');
}
/** Resolve only from authenticated account metadata; never guess an account subdomain. */
export async function resolveAddress(root, input, { env = process.env, run = privateCommand, fetch: request = globalThis.fetch } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Provide your workspace name and Cloudflare account.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 200) throw invalid('Enter a workspace name first.');
  if (typeof input.accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(input.accountId)) throw invalid('Choose a Cloudflare account first.');
  const prefix = input.prefix || derivePrefix(input.name);
  if (!prefix) throw invalid('Use a custom Cloudflare resource name for a workspace without Latin letters or numbers.');
  if (typeof prefix !== 'string' || !/^[a-z][a-z0-9-]{2,39}$/.test(prefix)) throw invalid('The custom resource name must use 3–40 lowercase letters, numbers or hyphens and start with a letter.');
  if (input.apiToken !== undefined && (typeof input.apiToken !== 'string' || input.apiToken.length > 2048 || /[\r\n]/.test(input.apiToken))) throw invalid('Provide a valid Cloudflare API token.');
  const headers = await authorization(root, input.apiToken, env, run);
  let response, body;
  try {
    response = await request(`https://api.cloudflare.com/client/v4/accounts/${input.accountId}/workers/subdomain`, { headers, signal: AbortSignal.timeout(12000), redirect: 'error' });
    if (response.status === 401 || response.status === 403) throw new AddressError('cloudflare_permission', 'Cloudflare could not read this account. Reconnect or use a token with Workers Scripts Read permission, or enter a custom app address.');
    if (response.status === 404) throw new AddressError('workers_subdomain_missing', 'Set up a workers.dev subdomain in your Cloudflare account, or enter a custom app address.');
    body = await response.json();
  } catch (error) {
    if (error instanceof AddressError) throw error;
    throw new AddressError('cloudflare_unavailable', 'Cloudflare could not confirm your app address. Try again or enter a custom app address.');
  }
  if (!response.ok || body?.success !== true) throw new AddressError('cloudflare_unavailable', 'Cloudflare could not confirm your app address. Check your account access or enter a custom app address.');
  const subdomain = body.result?.subdomain;
  if (typeof subdomain !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(subdomain)) throw new AddressError('workers_subdomain_missing', 'Set up a workers.dev subdomain in your Cloudflare account, or enter a custom app address.');
  const result={ prefix, appOrigin: `https://${prefix}.${subdomain.toLowerCase()}.workers.dev` };
  await assertWorkerAvailable(root,{...input,...result},{env,run,fetch:request});
  return result;
}
