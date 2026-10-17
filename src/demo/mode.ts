import type { Env } from '../platform/env'

/** True only inside `rer demo` or a hosted demo visitor's copy. Production build and deploy refuse RER_DEMO. */
export const demoMode = (env: Env) => env.RER_DEMO === '1'
