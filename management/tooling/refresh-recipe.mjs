import {writeFile} from 'node:fs/promises';
import {happytohelpPlan} from './compile-plan.mjs';
import {variableNames,secretNames} from '../../scripts/deployment/environment.mjs';
const plan=await happytohelpPlan({installationId:'recipe',environment:'production',variables:{H2H_PUBLIC_ORIGIN:'https://recipe.invalid',RER_MANAGEMENT_ORIGIN:'https://management.invalid',H2H_SETUP_OWNER_EMAIL:'owner@recipe.invalid'}});
const {workerName,publicVariables,secretNames:ignored,...recipe}=plan;
await writeFile(new URL('../../src/projects/integrations/happytohelp/recipe.json',import.meta.url),JSON.stringify({schema:1,source:'runeditrun/support-happytohelp',variableNames,secretNames,plan:recipe},null,2)+'\n');
