'use strict';
const {loadFixture,validateFixture}=require('./fixture');
const {settings,request}=require('./native-client');
async function main(){settings();const fixture=loadFixture().value;const failures=validateFixture(fixture);if(failures.length)throw new Error(failures.join('; '));const result=await request('/api/training/synthetic-workspace',{confirm:'happytohelp.synthetic-eval.v1',fixture});console.log(JSON.stringify(result));}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={main};
