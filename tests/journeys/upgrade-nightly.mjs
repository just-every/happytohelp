import test from 'node:test'
import {releaseUpgrades} from '../helpers/release-upgrade.mjs'

// Release qualification: nightly, release tags and on demand. Builds each published release from its own source.
// H2H_UPGRADE_RELEASES (comma-separated labels, such as 0.4.1) narrows the run to those releases.
test('every published release, populated through its own API, upgrades in place to this source with exactly the missing migrations in order and every prior row and file kept',{timeout:90*60_000},()=>releaseUpgrades(process.env.H2H_UPGRADE_RELEASES?.split(',')))
