import {readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {produceSeedArtifact} from './base/package.mjs';
import {generateDeploymentSpec} from './generate-spec.mjs';
export const config = JSON.parse(await readFile(new URL('./base/packaging.json', import.meta.url)));
export const produceArtifact = options => produceSeedArtifact({config, ...options});
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 if(process.argv.includes('--clean'))await rm(new URL('../../delivery-artifact/',import.meta.url),{recursive:true,force:true});
 console.log(await produceArtifact());
 console.log(await generateDeploymentSpec());
}
