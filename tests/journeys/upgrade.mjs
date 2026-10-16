import test from 'node:test'
import {priorSchemaUpgrade} from '../reports/prior-schema-upgrade.mjs'
import {historyScenarios} from '../reports/history-upgrade.mjs'

test('a packaged install populated before the outcome, integration, mail and import stages upgrades in place: prior rows, schema outside listed additions, stored files and search survive, and the upgraded Worker reads them back',{timeout:10*60_000},priorSchemaUpgrade)

test('historical conversations upgrade into conservative outcome cycles: closed history stays unknown, assisted receipts are not borrowed, insight displays are excluded, and forward answers are attributed honestly',async()=>{
 for(const scenario of historyScenarios){try{await scenario.fn()}catch(error){error.message=`${scenario.name}: ${error.message}`;throw error}}
})
