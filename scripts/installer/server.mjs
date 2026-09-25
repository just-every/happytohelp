import { startInstaller as shared } from '../base-onboarding/server.mjs';
import { seed } from './seed.mjs';
export const startInstaller=(root,options={})=>shared(root,{...options,seed});
