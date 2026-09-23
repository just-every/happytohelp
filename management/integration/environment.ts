/** Shared validation for initial setup and later managed configuration. */
export function validateHappyToHelpVariables(publicVariables:Record<string,string>){
 if(publicVariables.EMAIL_PROVIDER&&!['resend','cloudflare'].includes(publicVariables.EMAIL_PROVIDER))throw new Error('EMAIL_PROVIDER must be resend or cloudflare');
 if(publicVariables.EMAIL_PROVIDER==='cloudflare'&&!/^[a-f0-9]{32}$/i.test(publicVariables.EMAIL_ACCOUNT_ID??''))throw new Error('Cloudflare email requires EMAIL_ACCOUNT_ID');
 for(const key of ['REGISTRATION_ENABLED','ENABLE_SYNTHETIC_EVALUATION'])if(publicVariables[key]&&!['true','false'].includes(publicVariables[key]))throw new Error(`${key} must be true or false`);
 if(publicVariables.PREVIEW_ORIGIN){publicVariables.PREVIEW_ORIGIN=checkedOrigin(publicVariables.PREVIEW_ORIGIN);if(publicVariables.PREVIEW_ORIGIN===publicVariables.APP_ORIGIN)throw new Error('Preview requires separate origin');}
 if(publicVariables.QDRANT_URL){const url=new URL(publicVariables.QDRANT_URL);if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error('QDRANT_URL must be HTTPS without embedded credentials');}
 if(publicVariables.TRAINING_PRICE_CEILINGS){const values=JSON.parse(publicVariables.TRAINING_PRICE_CEILINGS);if(!values||Array.isArray(values)||typeof values!=='object')throw new Error('Training price ceilings require a model map');for(const value of Object.values(values) as Array<{inputPerMillion:number;outputPerMillion:number}>){if(!value||!Number.isFinite(value.inputPerMillion)||!Number.isFinite(value.outputPerMillion)||value.inputPerMillion<=0||value.outputPerMillion<=0)throw new Error('Training price ceilings require positive rates');}}
}

function checkedOrigin(value:string){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.port)throw Error('PREVIEW_ORIGIN must be an HTTPS origin');return url.origin;}
