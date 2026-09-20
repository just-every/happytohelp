import { isIP } from 'node:net';
import { assertProductionCloudflare, wranglerCredentials } from '../base-onboarding/wrangler-auth.mjs';

// Read-only account/zone validation. DNS conflicts and certificate issuance remain
// Wrangler deployment checks; a successful lookup does not promise publication.
export async function customDomainRoutes(root, account, hostnames, env, execute, request = globalThis.fetch) {
 if (!hostnames.length) return [];
 assertProductionCloudflare(env);
 for (const hostname of hostnames) if (isIP(hostname) || hostname.length > 253 || !hostname.includes('.') || hostname.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw Error('Custom app origins must use a DNS hostname in an active Cloudflare zone.');
 let headers;
 if (env.CLOUDFLARE_API_TOKEN) headers = {Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`};
 else if (env.CLOUDFLARE_API_KEY && env.CLOUDFLARE_EMAIL) headers = {'X-Auth-Key':env.CLOUDFLARE_API_KEY,'X-Auth-Email':env.CLOUDFLARE_EMAIL};
 else {
  let credentials;
  try { credentials = await wranglerCredentials(root, env, async (_file, args, options) => (await execute(['exec','wrangler',...args], {...options,capture:true})).stdout); }
  catch { throw Error('Cloudflare authentication could not validate the custom domain. Sign in with Wrangler or provide a credential with Zone Read access.'); }
  if (['oauth','api_token'].includes(credentials.type) && credentials.token) headers = {Authorization:`Bearer ${credentials.token}`};
  else if (credentials.type === 'api_key' && credentials.key && credentials.email) headers = {'X-Auth-Key':credentials.key,'X-Auth-Email':credentials.email};
  else throw Error('Cloudflare authentication could not validate the custom domain. Provide Zone Read access.');
 }
 const routes=[];
 for (const hostname of [...new Set(hostnames)]) {
  let zone;
  const labels=hostname.split('.');
  while (labels.length>1) {
   const name=labels.join('.'),query=new URLSearchParams({name,'account.id':account,match:'all'});
   let response,body;
   try { response=await request(`https://api.cloudflare.com/client/v4/zones?${query}`,{headers,redirect:'error',signal:AbortSignal.timeout(12000)});body=await response.json(); }
   catch { throw Error('Cloudflare could not validate the custom domain. No resources were provisioned.'); }
   if (!response.ok || body?.success!==true || !Array.isArray(body.result)) throw Error('Cloudflare could not read custom-domain zones. Check Zone Read access for the selected account. No resources were provisioned.');
   if (body.result.length) {
    if (body.result.length!==1 || body.result[0].name!==name || body.result[0].account?.id!==account || !/^[a-f0-9]{32}$/i.test(body.result[0].id)) throw Error('Cloudflare returned a zone outside the selected domain/account. No resources were provisioned.');
    zone=body.result[0];break;
   }
   labels.shift();
  }
  if (!zone || zone.status!=='active') throw Error(`Custom domain ${hostname} needs an active Cloudflare zone in the selected account before setup can provision resources.`);
  routes.push({pattern:hostname,custom_domain:true,zone_id:zone.id});
 }
 return routes;
}
