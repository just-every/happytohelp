export const product = { name: 'HappyToHelp', slugPrefix: 'h2h' };
export const branding = { name: 'HappyToHelp' };
export const features = { localTrialWithoutEmail: true, hosting: true, artwork: true, github: true };
export function readySummary(draft) { return `${draft.WORKSPACE_NAME} is ready to be installed ${draft.target === 'remote' ? 'on Cloudflare' : 'on this computer'}. Your owner account will use ${draft.OWNER_EMAIL}.`; }
