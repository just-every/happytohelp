import {Hono} from 'hono'
import type {AppEnv} from '../../platform/env'
import {projectPolicy} from './policy'
import {githubOAuth} from '../integrations/github-oauth'
import {billing} from '../integrations/billing'
import {invitations} from './invitations'
import {admin} from './admin'
import {projects} from './projects'
import {resources} from './resources'
import {widgetSettings} from './widget-settings'
import {integrations} from '../integrations/routes'
import {dashboard} from './dashboard'
import {dashboardMedia} from './dashboard-media'
import {dashboardActions} from './dashboard-actions'
export const routes=new Hono<AppEnv>()
routes.route('/',projects).route('/',resources).route('/',widgetSettings).route('/',integrations).route('/',admin).route('/',invitations).route('/',billing).route('/',githubOAuth).route('/',projectPolicy)
export const dashboardRoutes=new Hono<AppEnv>()
dashboardRoutes.route('/',dashboard).route('/',dashboardActions).route('/',dashboardMedia).route('/',resources)
export {publicWidget} from './widget-settings'

export {inboundEmail} from '../integrations/inbound'
export {widgetEvents} from './widget-events'
export {handleEmail} from '../integrations/email-worker'
export {notifyMessage} from '../integrations/notifications'

export {handleLeadJob,recoverLeadJobs} from '../integrations/leads'
