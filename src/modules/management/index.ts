import {workflowRoutes} from '../workflows/routes'
import {reports} from '../reports/routes'
import {Hono} from 'hono'
import type {AppEnv} from '../../platform/env'
import {projectPolicy} from './policy'
import {githubOAuth} from '../integrations/github-oauth'
import {invitations} from './invitations'
import {admin} from './admin'
import {projects} from './projects'
import {workspaceArtwork} from './workspace-artwork'
import {resources} from './resources'
import {contactErasure} from './contact-erasure'
import {widgetSettings} from './widget-settings'
import {integrations} from '../integrations/routes'
import {dashboard} from './dashboard'
import {demoInbox} from './demo-inbox'
import {dashboardMedia} from './dashboard-media'
import {dashboardActions} from './dashboard-actions'
import {aiSpend} from './ai-spend'
import {aiUsage} from './ai-usage'
import {activation} from './activation'
import {auditRoutes} from '../audit/routes'
import {roles,followers} from '../access/routes'
import {twoFactorPolicy} from '../identity/two-factor/policy-routes'
import {ticketRoutes} from '../tickets/routes'
import {queueRoutes} from '../tickets/views'
export const routes=new Hono<AppEnv>()
routes.route('/',activation).route('/',workspaceArtwork).route('/',projects).route('/',resources).route('/',contactErasure).route('/',widgetSettings).route('/',integrations).route('/',admin).route('/',invitations).route('/',githubOAuth).route('/',projectPolicy).route('/',auditRoutes).route('/',roles).route('/',twoFactorPolicy)
export const dashboardRoutes=new Hono<AppEnv>()
routes.route('/',workflowRoutes).route('/',ticketRoutes).route('/',queueRoutes)
dashboardRoutes.route('/',workflowRoutes).route('/',ticketRoutes).route('/',queueRoutes)
dashboardRoutes.route('/',reports).route('/',demoInbox).route('/',dashboard).route('/',dashboardActions).route('/',dashboardMedia).route('/',resources).route('/',aiUsage).route('/',aiSpend).route('/',followers)
export {publicWidget} from './widget-settings'

export {widgetEvents} from './widget-events'
