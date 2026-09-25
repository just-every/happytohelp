import {readFile,writeFile} from 'node:fs/promises';
import {happytohelpPlan} from './compile-plan.mjs';
import {variableNames,secretNames} from '../../scripts/deployment/environment.mjs';
const {repository}=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
const source=new URL(repository.url).pathname.slice(1);
const plan=await happytohelpPlan({installationId:'recipe',environment:'production',variables:{H2H_PUBLIC_ORIGIN:'https://recipe.invalid',RER_MANAGEMENT_ORIGIN:'https://management.invalid',H2H_SETUP_OWNER_EMAIL:'owner@recipe.invalid'}});
const {workerName,publicVariables,secretNames:ignored,...recipe}=plan;
await writeFile(new URL('../integration/recipe.json',import.meta.url),JSON.stringify({schema:1,source,variableNames,secretNames,plan:recipe},null,2)+'\n');
