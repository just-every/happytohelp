import test from 'node:test'
import {monitoringJourney} from '../helpers/context/monitoring.mjs'
import {profilesJourney,inventoryJourney} from '../helpers/context/profiles.mjs'
import {leadsJourney} from '../helpers/context/leads.mjs'

// Customer context on the real application: widget events, operator routes and queued runs;
// only the model, mail and website providers are fixtures.

test('a consenting visitor\'s widget activity is analysed in bounded, attributable windows once per due burst, summarised, offered as a dismissible insight, and never shows the model agent drafts or another visitor\'s data',monitoringJourney)

test('contact profiles cite current evidence, skip unchanged evidence, retract contradicted claims, write nothing when consent ends mid-run, never retry an uncertain attempt, and fail closed for an unconfigured model',profilesJourney)

test('the insight inventory pages completely within its workspace and members, and operator context inputs are validated before storage',inventoryJourney)

test('platform lead operations process each lead once from its own website, refuse redirects, record usage, send only reviewed drafts and leave interrupted paid work uncertain',leadsJourney)
