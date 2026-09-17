import { normalizeEmail } from './email.mjs';
export function validateInput(input,env=process.env,providers={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Provide installation details.');
 const v={};
 for(const key of ['ownerName','name']){if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>200)throw Error('Owner and workspace names are required (up to 200 characters).');v[key]=input[key].trim()}
 if(typeof input.email!=='string'||input.email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))throw Error('Enter a valid owner email.');v.email=input.email.trim().toLowerCase();
 if(typeof input.password!=='string'||input.password.length<12||input.password.length>1024)throw Error('Use a password of at least 12 characters.');v.password=input.password;
 if(!/^#[0-9a-f]{6}$/i.test(input.primaryColor||''))throw Error('Choose a valid brand colour.');v.primaryColor=input.primaryColor;
 const website=new URL(input.allowedOrigin);if(!['http:','https:'].includes(website.protocol)||website.username||website.password)throw Error('Use a website without embedded credentials.');v.allowedOrigin=website.origin;
 if(!['local','remote'].includes(input.target))throw Error('Select local or Cloudflare installation.');v.target=input.target;
 if(v.target==='remote'){
  if(!/^[a-f0-9]{32}$/i.test(input.accountId||''))throw Error('Cloudflare account ID must have 32 hexadecimal characters.');v.accountId=input.accountId;
  if((!input.apiToken||typeof input.apiToken!=='string')&&!providers.cloudflare?.authenticated&&!env.CLOUDFLARE_API_TOKEN)throw Error('Connect Cloudflare or enter your API token.');if(input.apiToken&&input.apiToken.length>2048)throw Error('Invalid Cloudflare token.');v.apiToken=input.apiToken||env.CLOUDFLARE_API_TOKEN||'';
  if(!/^[a-z][a-z0-9-]{2,39}$/.test(input.prefix||''))throw Error('Choose a lowercase resource name (3–40 characters).');v.prefix=input.prefix;
  const origin=new URL(input.appOrigin);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||origin.port)throw Error('Enter the HTTPS origin where the app will be deployed.');v.appOrigin=origin.origin;
 }
 v.emailConfiguration=normalizeEmail(input.emailConfiguration,env);
 v.emailProvider=v.emailConfiguration.provider;v.emailFrom=v.emailConfiguration.from||'';v.emailAccountId=v.emailConfiguration.accountId||'';
 return v;
}
