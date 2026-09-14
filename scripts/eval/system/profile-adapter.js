'use strict';
const {runCase}=require('../native-client');
module.exports={run:({fixture,model})=>runCase({model,caseDefinition:{...fixture,family:'profile'}}),close:async()=>{}};
