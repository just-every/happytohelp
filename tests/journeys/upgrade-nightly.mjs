import test from 'node:test'
import {releaseUpgrades} from '../helpers/release-upgrade.mjs'

// Release qualification: nightly, release tags and on demand. Builds each published release from its own source.
test('every published release, populated through its own API, upgrades in place to this source with exactly the missing migrations in order and every prior row and file kept',{timeout:90*60_000},()=>releaseUpgrades())
