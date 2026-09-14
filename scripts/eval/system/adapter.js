'use strict';
const {runCase}=require('../native-client');
const {monitoringEvalCases}=require('./monitoring-cases');
async function runMonitoring({caseId,model,insightModel=model}){const fixture=monitoringEvalCases.find(c=>c.id===caseId);if(!fixture)throw new Error('Unknown monitoring case');return runCase({model,caseDefinition:{...fixture,family:'monitoring',insightModel}});}
module.exports={runMonitoring,close:async()=>{}};
