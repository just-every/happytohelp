import {type App,type Integration} from './contracts';
import {registerDevices} from './devices';
import {registerAuthorization} from './authorization';
import {registerJobs} from './jobs';
import {registerResults} from './results';
import {registerLocalSetup} from './setup';
export * from './contracts';
export function registerLocalComputerRoutes(app:App,integration:Integration){registerLocalSetup(app);registerDevices(app,integration);registerAuthorization(app,integration);registerJobs(app,integration);registerResults(app,integration);}
export {recoverLocalResultEffects} from './results';
