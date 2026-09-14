import type { Env } from '../../platform/env';
export interface TrainingExecution {projectId:string;model:string;variant:string;caseDefinition:Record<string,any>;maxTokens:number;maxCost:number;attemptId:string;}
export interface TrainingResult {output:unknown;toolCalls?:unknown[];imageInputs?:unknown[];usage:{cost:number|null;inputTokens?:number;outputTokens?:number};[key:string]:unknown;}
export type TrainingExecutor=(env:Env,input:TrainingExecution)=>Promise<TrainingResult>;
