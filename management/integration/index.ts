import profile from './profile.json';
import {createPlanGenerator} from './plan';
import {revisePlan,fixedVariables} from './revision';
import type {IntegrationHost,ProjectIntegration} from './contract';
export function createIntegration(host:IntegrationHost):ProjectIntegration{return {
 profile,sourceEnvironmentPrefix:'H2H',surfaces:{app:'/setup',websitePreview:'/preview/'},fixedVariables,
 generatedConfiguration:addresses=>({H2H_PUBLIC_ORIGIN:`https://${addresses.app.hostname}`,PREVIEW_ORIGIN:`https://${addresses.websitePreview!.hostname}`}),
 generatePlan:createPlanGenerator(host),revisePlan,
 validateAddresses(plan){const a=plan.addresses,v=plan.publicVariables;if(!a?.websitePreview||a.page||v.APP_ORIGIN!==`https://${a.app.hostname}`||v.PREVIEW_ORIGIN!==`https://${a.websitePreview.hostname}`||a.app.path!=='/setup'||a.websitePreview.path!=='/preview/')throw Error('HappyToHelp origins differ from accepted addresses');},
};}
