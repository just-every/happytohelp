export { installationReceipt,installationCredential,stopChild,persistLocalEmail,localEmailBindings } from '../base-onboarding/private.mjs';
import { localSetupToken as readToken } from '../base-onboarding/private.mjs';
export const localSetupToken=root=>readToken(root,'H2H_SETUP_TOKEN');
