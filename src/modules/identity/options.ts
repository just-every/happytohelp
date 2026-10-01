import { Hono } from 'hono'
import type { AppEnv } from '../../platform/env'
import { recoveryAvailable, registrationAvailable } from './availability'
import { setupAvailable } from './setup'

export const options = new Hono<AppEnv>()
// What a signed-out visitor may be offered. It reveals three deployment switches and no account or workspace data.
options.get('/auth-options', async c => {
 c.header('Cache-Control', 'no-store')
 const setupRequired = await setupAvailable(c.env.DB)
 // The first owner is created in setup; sign-up opens only once the installation has been claimed.
 return c.json({setupRequired, registrationAvailable: !setupRequired && registrationAvailable(c.env), recoveryAvailable: recoveryAvailable(c.env)})
})
