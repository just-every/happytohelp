import { createSecretVault as shared } from '../base-onboarding/secrets.mjs';
import { seed } from './seed.mjs';
export const createSecretVault=()=>shared(seed.model);
