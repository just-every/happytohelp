import {variableNames,secretNames} from '../deployment/environment.mjs';
export const specInputs={
 publicVariableNames:['APP_ORIGIN',...variableNames],
 secretNames:[], optionalSecretNames:secretNames,
 recovery:'Retain source, D1 backups and R2 objects. Preserve applied migration history and reconcile uncertain provider jobs before resuming. Restore data into separate resources and verify before switching traffic.',
};
