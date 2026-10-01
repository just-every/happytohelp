import type { Env } from '../../platform/env'
import { emailConfigured } from '../integrations/email'

/** Self-service sign-up needs the switch on and a way to deliver the verification email. */
export const registrationAvailable = (env: Env) => env.REGISTRATION_ENABLED === 'true' && emailConfigured(env) && Boolean(env.APP_ORIGIN)
/** Password recovery by email needs a delivery route and the origin that goes into the reset link. */
export const recoveryAvailable = (env: Env) => emailConfigured(env) && Boolean(env.APP_ORIGIN)
