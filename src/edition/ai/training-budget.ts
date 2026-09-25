import type {Env} from '../../platform/env'
import type {TrainingExecution} from '../../modules/training-runs/contracts'
// @ts-ignore Selected provider model catalogue.
import {findModel} from '../../modules/ai-support/vendor/ensemble/data/model_data.js'
export function checkTrainingBudget(env:Env,input:TrainingExecution){
 const pricing=JSON.parse(String(env.TRAINING_PRICE_CEILINGS||'{}'))[input.model]
 const model=findModel(input.model),contextLimit=model?.features?.context_length
 if(!pricing||!Number.isFinite(pricing.inputPerMillion)||!Number.isFinite(pricing.outputPerMillion)||pricing.inputPerMillion<=0||pricing.outputPerMillion<=0||!Number.isFinite(contextLimit))throw new Error('CONFIGURATION_REQUIRED: model TRAINING_PRICE_CEILINGS and context limit')
 // Four provider requests maximum: two passes with two rounds each. The whole
 // input context window is reserved, including later tool/history additions.
 const ceiling=4*(contextLimit*pricing.inputPerMillion+input.maxTokens*pricing.outputPerMillion)/1e6
 if(!Number.isSafeInteger(input.maxTokens)||input.maxTokens<1||!Number.isFinite(input.maxCost)||input.maxCost<ceiling)throw new Error(`TRAINING_BUDGET_INSUFFICIENT: required ceiling ${ceiling}`)
 return ceiling
}
