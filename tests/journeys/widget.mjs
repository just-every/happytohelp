import test from 'node:test'
import {widgetEventsJourney} from '../helpers/widget/events.mjs'
import {socketJourney} from '../helpers/widget/socket.mjs'
import {lostResponseJourney} from '../helpers/widget/lost-response.mjs'

// The widget's server doors on the real application: widget events, conversation sockets, and the widget's own
// transport against the application with the network between them faulted.

test('widget commands are scoped to the visitor\'s own conversation and workspace, replay an insight pair exactly, record reads and observed presence, recheck live authority each time, gate monitoring on consent and resume one waiting turn',widgetEventsJourney)

test('conversation sockets admit only the right token, origin and membership, replay durably without operator-only data, stream project activity to operators, keep private notes from visitors, deliver first reads live and close on revocation',socketJourney)

test('the widget transport retries a response lost after commit with the same command and frontier, refreshes after a definitive refusal, and surfaces a rate limit without replaying the command',lostResponseJourney)
