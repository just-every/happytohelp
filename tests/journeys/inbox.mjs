import test from 'node:test'
import {managementJourney} from '../helpers/inbox/management.mjs'
import {inboxSearchJourney} from '../helpers/inbox/search.mjs'
import {artworkJourney} from '../helpers/inbox/artwork.mjs'
import {libraryValidationJourney} from '../helpers/inbox/library-validation.mjs'
import {appearanceJourney} from '../helpers/inbox/appearance.mjs'

// The operator's workspace on the real application's routes; fixtures only at the mail provider, DNS and crawler.

test('workspace management keeps settings, resources, bootstrap, owners, notes, participants, transcript mail, widget origins, presence and mailbox ownership within each workspace\'s current authority',managementJourney)

test('inbox search matches literally across names, emails, supplied identity and all history from an index built later and kept by every write, composes with status, assignment and AI views, and bounds its terms',inboxSearchJourney)

test('workspace artwork is shared with members, changed only by permitted roles within the workspace, and stored and cleaned up atomically',artworkJourney)

test('library inputs are validated before storage: crawl limits, contacts without an identifier and the last owner are refused, and stored out-of-range limits never start the crawler',libraryValidationJourney)

test('appearance settings persist whole or not at all, keep Unicode and limits, reset cleanly, respect roles and tenants, and the public brand never shows older invalid values',appearanceJourney)
