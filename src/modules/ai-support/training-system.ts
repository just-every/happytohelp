// Retained system evaluation request builders; the caller supplies an explicit case context.
// @ts-ignore Retained CJS source.
import * as monitoring from '../customer-context/monitoring/prompt.js'
// @ts-ignore Retained CJS source.
import * as profiles from '../customer-context/profiles/prompt.js'
// @ts-ignore Retained CJS source.
import * as validation from '../customer-context/profiles/validation.js'
// @ts-ignore Retained schemas.
import * as schemas from '../customer-context/profiles/schemas.js'
// @ts-ignore Retained neutral orchestration.
import {runStream,TASKS} from './llm/orchestrator.js'
export async function executeSystemCase(input:any,trace:any){
 const definition=input.caseDefinition,context=definition.context
 if(!context)throw new Error('System evaluation requires explicit case context')
 const options={model:input.model,maxToolCalls:0,maxToolCallRoundsPerTurn:1,modelSettings:{max_tokens:input.maxTokens}}
 const run=(task:string,request:any,name:string,model=input.model)=>runStream({project_id:input.projectId,task,messages:request.messages,schema:request.schema,response_name:name,options:{...options,model},trace})
 if(definition.family==='monitoring'){
  const analysisRequest=monitoring.buildAnalysisRequest(context),analysis=await run(TASKS.ANALYSIS,analysisRequest,'activity_decision')
  const stages:any={analysis}
  if(analysis.decision==='insight')stages.insight=await run(TASKS.INSIGHT,monitoring.buildInsightRequest({...context,monitoring_packet:analysisRequest.packet,insight_analysis:analysis}),'activity_insight',definition.insightModel||input.model)
  return {output:stages,stages,valid:true,response:stages}
 }
 if(definition.family==='profile'){
  const names:Record<string,string>={project:'projectSchema',contact:'contactSchema',agent:'agentSchema',optimize:'projectContentOptimizeSchema',optimizeContact:'optimizeContentSchema'}
  const builder=(schemas as any)[names[definition.type]]
  if(!builder)throw new Error('Unsupported profile evaluation type')
  const request=profiles.buildProfilePrompt(definition.type,context),schema=builder(context)
  const response=await run(definition.type.startsWith('optimize')?TASKS.OPTIMIZE:TASKS.PROFILE,{...request,schema},definition.type)
  const valid=schema.safeParse(response).success&&(definition.type==='optimize'?validation.isOptimizationCandidate(response,request.packet):definition.type==='optimizeContact'?validation.isContactOptimizationCandidate(response,request.packet):validation.isProfileCandidate(definition.type,response,request.packet))
  return {output:response,response,valid}
 }
 throw new Error('Unsupported system evaluation family')
}
