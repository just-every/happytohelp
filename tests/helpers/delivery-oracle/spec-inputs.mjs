import {variableNames,secretNames} from '../../../scripts/deployment/environment.mjs';
export const specInputs={
 providerEffects:['ai','outbound-mail','knowledge-crawl','knowledge-vector-store','support-imports','github','website-fetch','turnstile'],
 publicVariableNames:['APP_ORIGIN',...variableNames],
 secretNames:['H2H_SETUP_TOKEN'], optionalSecretNames:secretNames.filter(name=>name!=='H2H_SETUP_TOKEN'),
 surfaces:{app:{path:'/',originVariable:'APP_ORIGIN'},websitePreview:{path:'/preview/',originVariable:'PREVIEW_ORIGIN',readiness:[{path:'/preview/invalid/invalid/',statuses:[403]}]}},
 initialSetup:{path:'/api/identity/setup-status',pendingStatus:409,completeStatus:200},
 recovery:'Retain source, D1 backups and R2 objects. Preserve applied migration history and reconcile uncertain provider jobs before resuming. Restore data into separate resources and verify before switching traffic.',
};
