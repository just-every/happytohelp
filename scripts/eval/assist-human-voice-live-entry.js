'use strict';
const {runCase}=require('./native-client');
const {contextForCase,evaluateHumanVoice}=require('./assist-human-voice');
const LIVE_MODEL='gpt-5.6-luna';
async function runLiveCase(fixture){const context=contextForCase(fixture);const result=await runCase({model:LIVE_MODEL,caseDefinition:{...fixture,family:'human_voice',context}});return {...result,checks:evaluateHumanVoice(fixture,result.output)};}
module.exports={LIVE_MODEL,runLiveCase};
