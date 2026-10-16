import test from 'node:test'
import {installedJourney} from '../helpers/widget/runtime.mjs'
import {openingJourney} from '../helpers/widget/opening.mjs'
import {pointerSendJourney} from '../helpers/widget/pointer-send.mjs'
import {settingsJourney} from '../helpers/widget/settings.mjs'
import {lifecycleJourney} from '../helpers/widget/lifecycle.mjs'

// The widget in Chromium against the emitted Worker; each case starts its own installation.

test('the installed widget: a cached /widget.js for this installation, the legacy project lookup for allowed origins, current and legacy installs and open modes on a separate site, a failed send and its recovery, and foreign conversations refused',installedJourney)

test('opening the widget at 1440 and 390 keeps every opened state readable against its background',openingJourney)

test('at 1440 and 390 the widget opens, sends repeatedly by pointer and keyboard, closes, reopens and reloads with the same conversation',pointerSendJourney)

test('the widget settings editor shows the widget\'s own defaults, stores only edits, previews them live and the installed widget renders the saved settings',settingsJourney)

test('the widget bundle cleans up its collector, remounts actions, ignores stale live handles, stops on consent revocation and destroys and remounts its preview',lifecycleJourney)
