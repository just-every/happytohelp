import { createState as shared } from '../base-onboarding/state.mjs';
import { seed } from './seed.mjs';
export const createState=(root)=>shared(root,seed);
