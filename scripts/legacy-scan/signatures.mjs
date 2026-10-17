// Independent secret signatures for exported legacy packages. Written apart from the
// exporter's text policy (scripts/legacy-export) and sharing none of its rules or
// placeholder list, so a miss in one is caught by the other. Never returns a value:
// callers report kinds, files, row ids and masked shapes.

// Documentation placeholders this scan accepts in "-u user:secret" and labelled values.
const placeholderNames=new Set(['api_key','apikey','api_secret','secret_key','secret','secretkey','access_key','access_token','auth_token','token','key','password','passwd','pass','username','user','login','email','client_id','client_secret','account_sid','sk_test','sk_live','your_api_key','your_secret_key','your_key','your_token','your_password','my_api_key','value','name','redacted']);
export function placeholderValue(value){
  const v=value.replace(/\\_/g,'_').trim();
  if(v===''||/^(?:<[^<>]*>|\[[^[\]]*\]|\{\{?[^{}]*\}\}?|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|%[A-Za-z_]+%)$/.test(v))return true;
  if(/^(?:x{3,}|X{3,}|\*{3,}|\.{3,}|…|0{6,}|redacted)$/i.test(v))return true;
  if(/^(?:your|my)[_-]/i.test(v))return true;
  // An environment variable's name ("STRIPE_SECRET_KEY") documents where the value lives.
  if(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:API_)?(?:KEY|SECRET|TOKEN|PASSWORD|PASS)$/.test(v))return true;
  return placeholderNames.has(v.toLowerCase());
}
export const redactedValue=value=>/^(?:<redacted>|\[redacted\]|%3Credacted%3E)/i.test(value);

// Layer 1: provider and transport signatures over raw file bytes (latin1), JSON escapes
// included. Each entry is [pattern, optional keep(match)].
const ok=v=>!redactedValue(v)&&!placeholderValue(v);
export const byteSignatures={
  'stripe-secret-key':[/(?<![A-Za-z0-9])[rs]k(?:\\{0,2}_(?:live|test))?\\{0,2}_[0-9A-Za-z]{16,}/g,m=>/_(?:live|test)\\{0,2}_/.test(m[0])||/_[0-9A-Za-z]{24,}$/.test(m[0])],
  'stripe-webhook-or-client-secret':[/whsec_[0-9A-Za-z]{16,}|(?:pi|seti)_[0-9A-Za-z]+_secret_[0-9A-Za-z]+/g],
  'aws-access-key-id':[/(?<![A-Z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Z0-9])/g],
  'github-token':[/gh[oprsu]_[0-9A-Za-z_]{20,}|github_pat_[0-9A-Za-z_]{20,}/g],
  'openai-or-anthropic-key':[/(?<![A-Za-z0-9])sk-(?:proj-|ant-[a-z0-9]+-)?[0-9A-Za-z_-]{20,}/g],
  'sendgrid-key':[/SG\.[0-9A-Za-z_-]{16,}\.[0-9A-Za-z_-]{16,}/g],
  'slack-token':[/xox[abeoprs]-[0-9A-Za-z-]{10,}|xapp-\d-[0-9A-Za-z-]{10,}/g],
  'slack-or-discord-webhook':[/hooks\.slack\.com\/(?:services|workflows|triggers)\/[0-9A-Za-z_/-]{8,}|discord(?:app)?\.com\/api\/webhooks\/\d+\/[0-9A-Za-z_-]{20,}/g],
  'shopify-token':[/shp(?:at|ca|pa|ss)_[0-9a-fA-F]{32}/g],
  'gitlab-token':[/gl(?:pat|dt|rt|ptt|oas|cbt|soat)-[0-9A-Za-z_-]{20,}/g],
  'hubspot-private-app':[/pat-(?:na|eu|ap)[0-9]-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/g],
  'google-credential':[/AIza[0-9A-Za-z_-]{35}|GOCSPX-[0-9A-Za-z_-]{20,}|(?<![0-9A-Za-z])1\/\/0[0-9A-Za-z_-]{40,}/g],
  'npm-or-atlassian-token':[/npm_[0-9A-Za-z]{36}|ATATT[0-9A-Za-z_=-]{30,}/g],
  'square-or-meta-token':[/(?<![0-9A-Za-z])(?:EAA[0-9A-Za-z]{2}[0-9A-Za-z_-]{40,}|sq0csp-[0-9A-Za-z_-]{30,})/g],
  'braintree-or-mail-provider-key':[/access_token\$(?:production|sandbox)\$|(?<![0-9A-Za-z])key-[0-9a-f]{32}(?![0-9A-Za-z])|(?<![0-9A-Za-z])[0-9a-f]{32}-us[0-9]{1,2}(?![0-9A-Za-z])/g],
  'bot-token':[/(?<![0-9])[0-9]{8,10}:AA[0-9A-Za-z_-]{30,}|(?<![0-9A-Za-z])[MNO][0-9A-Za-z_-]{23,25}\.[0-9A-Za-z_-]{6}\.[0-9A-Za-z_-]{27,}/g],
  'azure-account-key':[/AccountKey=(?!<redacted>)[0-9A-Za-z+/]{40,}/g],
  'pem-private-key':[/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY(?: BLOCK)?-----/g],
  'jwt':[/eyJ[0-9A-Za-z_-]{8,}\.eyJ[0-9A-Za-z_-]{8,}\.[0-9A-Za-z_-]{8,}/g],
  'basic-credential-u':[/(?:^|[\s'"`(]|\\[nrt"])(?:-u|--user)(?:[ \t]+|=)(?:\\?["'])?([^\s"'`:\\]*):([^\s"'`\\]*)/g,m=>(m[1]||m[2])&&(ok(m[1])||ok(m[2]))&&!redactedValue(m[1])],
  'curl-cookie':[/(?:^|[\s'"`(]|\\[nrt"])(?:-b|--cookie)(?:[ \t]+|=)(?:\\?["'])?([^\s"'`\\]*=[^\s"'`\\]*)/g,m=>!redactedValue(m[1])],
  'url-userinfo':[/[a-z][a-z0-9+.-]*:\/\/([^\s/@:"'<>()[\]\\\x00-\x1f\x7f-\xff]*):([^\s/@"'<>()[\]\\\x00-\x1f\x7f-\xff]+)@/gi,m=>m[1].toLowerCase()!=='mailto'&&!redactedValue(m[1])&&!redactedValue(m[2])],
  'credential-query-parameter':[/[?&](?:amp;)?(?:pwd|pass|password|passwd|token|access_token|refresh_token|id_token|api_key|apikey|api_token|client_secret|auth_token|auth|_s|sig|signature|rlkey|resourcekey|otp|X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|AWSAccessKeyId)=([^&\s<>"'()[\]\\]+)/gi,m=>!redactedValue(m[1])&&!/^(?:1|true|false)$/.test(m[1])],
  'base32-setup-key-groups':[/\bkey\b[^\n\\]{0,24}?[:=][ \t]*(?:<redacted>[ \t]+)?[A-Z2-7]{4}(?:[ \t]+[A-Z2-7]{4}){2,}(?![A-Za-z0-9])/gi],
  'redacted-remnant':[/(?:key|secret|token|password|passwd|pwd|credential|auth)["']?[ \t]*[:=][ \t]*<redacted>[,;][^\s"'\\<]/gi],
  'bearer-credential':[/Bearer[ \t]+(?!<redacted>|\[redacted\])([0-9A-Za-z._~+/=-]{12,})/gi,m=>/[0-9]/.test(m[1])&&/[A-Za-z]/.test(m[1])||/[a-z][A-Z]/.test(m[1])],
  'basic-authorization':[/Basic[ \t]+([0-9A-Za-z+/]{8,}={0,2})(?![0-9A-Za-z+/=])/g,m=>Buffer.from(m[1],'base64').toString('latin1').includes(':')&&Buffer.from(m[1],'base64').toString('base64').replace(/=+$/,'')===m[1].replace(/=+$/,'')],
  'stripe-token-or-checkout':[/(?<![0-9A-Za-z])(?:tok_[0-9A-Za-z]{16,}|cs_(?:live|test)_[0-9A-Za-z_]{16,})/g],
  'chargedesk-inbound-address':[/[0-9A-Za-z._+-]{40,}@(?:mail\.)?chargedesk\.com/gi],
  'license-key':[/(?:licen[cs]e|serial|activation|product)[ _-]?key["']?[ \t]*[:=][ \t]*["']?[0-9A-Z]{4,}(?:-[0-9A-Z]{4,}){2,}/gi],
  'har-cookie-pair':[/\\?"name\\?"\s*:\s*\\?"(?:set-)?cookies?\\?"\s*,\s*\\?"value\\?"\s*:\s*\\?"(?!<redacted>|\[redacted\]|\\?")/gi],
};

// Layer 2: checks over decoded row and context strings, where line breaks and quotes are real.
// A label is any name ending in a credential word: "MAIL_PASSWORD", "x-api-key", "secretKey",
// "Passwort", "mot de passe". Values follow ":"/"=", "is", or (long ones) a space.
const passwordWord='password|passwort|passwd|passcode|passphrase|pass|pwd|pw|contraseña|mot de passe|parola|senha|wachtwoord';
const labelName=`[\\p{L}\\p{N}_.-]*?(?:${passwordWord}|secret|token|key)`;
const labelledValue=new RegExp(`(?<![\\p{L}\\p{N}])(${labelName})(["'\\\\*]*)(?:([ \\t]*[:=][ \\t]*\\n?[ \\t]*)|(\\s+(?:is|was|ist|est|es)\\s*:?\\s+)|([ \\t]+))([*_]{0,2}[ \\t]*)(?:\\\\?"((?:\\\\.|[^"\\\\\\n])*)\\\\?"|'([^'\\n]*)'|\`([^\`\\n]*)\`|([^\\s"'\`<>()[\\]*]+))`,'giu');
// A value is secret-shaped when it mixes letters with digits or symbols, or carries a
// capital inside a word; the trailing sentence punctuation is not part of it.
function secretShaped(raw){
  const v=raw.replace(/[.,:;?)\]]+$/,'');
  if(/^[A-Z2-7]{16,}$/.test(v))return true;
  if(v.length<6||!/[A-Za-z]/.test(v)||/^https?:/.test(v))return false;
  return /[0-9]/.test(v)||/[a-z][A-Z]/.test(v)||/[!@#$%^&*+=~,;]/.test(v);
}
// Key names that identify, sort or deduplicate rather than authenticate.
const nonsecretName=/(?:idempotency|public|publishable|cache|sort|primary|foreign|partition|object|storage|s3|lookup|map|hash|row|dedup(?:e|lication)?|sentry)[ _-]?key$/;
function* labelledValues(text){
  for(const m of text.matchAll(labelledValue)){
    // A bold label ("**Use a Strong Password**: Make sure…") is often a heading: judge its value by shape.
    const name=m[1].toLowerCase(),bold=/[*_]/.test(m[2]+m[6]),assigned=m[3]!==undefined&&!bold,bare=m[5]!==undefined,value=(m[7]??m[8]??m[9]??m[10]).replace(/[.,:;?)\]]+$/,'');
    if(nonsecretName.test(name)||!/^[\x20-\x7e]+$/.test(value))continue;
    if(!value||redactedValue(value)||placeholderValue(value)||/^(?:true|false|null|none|undefined)$/i.test(value)||/^[a-z][a-z0-9+.-]*:\/\//i.test(value)||/\*{3,}/.test(value))continue;
    // A bare "key VALUE" needs a long value that mixes letters and digits, or a base32 run.
    if(bare&&!(/^(?:secret|token|key|password)$/.test(name)&&value.length>=16&&(/[0-9]/.test(value)&&/[A-Za-z]/.test(value)||/^[A-Z2-7]{16,}$/.test(value))))continue;
    // Any value assigned to a password name counts; other names need a secret-shaped value.
    // ("pass" and "pw" are also ordinary words, so they need a secret-shaped value).
    if(assigned&&/(?:password|passwort|passwd|passcode|passphrase|pwd|contraseña|mot de passe|parola|senha|wachtwoord)$/u.test(name)&&value.length>=4||secretShaped(value))yield value;
  }
}
const cookieLine=/(?:^|\n)[ \t]*(?:set-)?cookies?[ \t]*:[ \t]*(?!<redacted>|\[redacted\])[^\n]*=/gim;
const inlineCookie=/(?<![\w-])(?:set-)?cookies?[ \t]*(?::[ \t]*|\r?\n[ \t]*)(?!<redacted>|\[redacted\])[^\s=;:"'<>]+=[^\s;"'<>]{4,}/gi;
const harCookieList=/"cookies"\s*:\s*\[[^\]]*?"value"\s*:\s*"(?!<redacted>|\[redacted\]|")/gi;
// The line after a removed value: a key-shaped remnant means the removal stopped at a wrap.
const afterRedacted=/(?:<redacted>|\[redacted\])[)\]>"'`*]*[ \t\\]*\r?\n(?:[ \t]*>)*[ \t]*([0-9A-Za-z+/=_%.~-]{8,})(?=[\s"'`)\]>,;]|$)/g;
function wrapRemnant(token){
  if(/^[A-Za-z_][\w.-]*[:=]./.test(token))return false;
  return /[0-9]/.test(token)&&/[A-Za-z]/.test(token)||token.length>=16&&/[a-z]/.test(token)&&/[A-Z]/.test(token);
}
const appPasswordGroups=/(?:application|app)[ _-]?password[^\n]{0,12}?[:=][ \t]*(?:<redacted>[ \t]+)?((?:[0-9A-Za-z]{4}[ \t]+){3,}[0-9A-Za-z]{4})(?![0-9A-Za-z])/gi;
// Bare opaque runs outside links: a random string of 32+ characters shows most of the
// alphabet it draws from. Links are references here unless they name a sign-in capability.
const urlPattern=/[a-z][a-z0-9+.-]*:\/\/[^\s<>"'`()[\]]+/gi;
const bareRun=/(?<![0-9A-Za-z+/_.-])[0-9A-Za-z+/_-]{32,}={0,2}(?![0-9A-Za-z+/=_-])/g;
function randomLooking(run){
  const r=run.replace(/=+$/,'');
  if(!/[A-Z]/.test(r)||!/[a-z]/.test(r)||!/[0-9]/.test(r))return false;
  // Paths and slugs of words, CamelCase words, numbers and short codes are names, not secrets.
  const parts=r.split(/[-_/+]+/).filter(Boolean);
  if(parts.length>1&&parts.every(p=>p.length<=8||/^(?:[A-Z]?[a-z]+)+[0-9]*$|^[A-Z]+[0-9]*$|^[0-9]+[a-z]{0,3}$/.test(p)))return false;
  const distinct=new Set(r).size;
  return distinct>=Math.min(22,Math.round(r.length*0.55));
}
// UUIDs and payment-provider object ids ("ch_…", "sub_sched_…") identify records; they grant nothing.
const uuidPattern=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const paymentObject=/(?<![0-9A-Za-z])(?:acct|ba|ca|card|ch|cn|cs|cus|dp|evt|ii|il|in|po|pi|pm|price|prod|plan|py|re|seti|si|src|sub|sub_sched|tr|txn|pk_live|pk_test)_[0-9A-Za-z]{8,}/g;
const capabilityLink=/\/(?:login|log-in|signin|sign-in|magic(?:-link)?|reset|password|verify|confirm|activate|invite|invitation)s?\/(?:[^/\s?#]+\/)*?[0-9A-Za-z_-]{20,}(?:[/?#]|$)/i;
export function* stringFindings(text){
  for(const value of labelledValues(text))yield ['labelled-value',value];
  for(const m of text.matchAll(cookieLine))yield ['cookie-header',m[0]];
  for(const m of text.matchAll(inlineCookie))yield ['cookie-header',m[0]];
  for(const m of text.matchAll(harCookieList))yield ['har-cookie-list',m[0]];
  for(const m of text.matchAll(afterRedacted))if(wrapRemnant(m[1]))yield ['wrapped-remnant',m[1]];
  for(const m of text.matchAll(appPasswordGroups))if(/[0-9]|[a-z][A-Z]/.test(m[1]))yield ['application-password-groups',m[1]];
  for(const m of text.matchAll(urlPattern))if(capabilityLink.test(m[0].replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i,''))&&!/<redacted>/.test(m[0]))yield ['capability-link',m[0]];
  const bare=text.replace(urlPattern,' ').replace(uuidPattern,' ').replace(paymentObject,' ').replace(/pk_(?:live|test)_[0-9A-Za-z]+/g,' ').replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[0-9A-Za-z+/=]+/gi,' ').replace(/sha(?:256|384|512)-[0-9A-Za-z+/]+={0,2}/g,' ').replace(/\bp=[0-9A-Za-z+/]+={0,2}/g,' ').replace(/(?:^|[\s"'`(])(?:\/[^\s"'`]+)+/g,' ');
  for(const m of bare.matchAll(bareRun))if(randomLooking(m[0]))yield ['opaque-run',m[0]];
}
