export const product = { name: 'HappyToHelp', slugPrefix: 'h2h' };
export const branding = { name: 'HappyToHelp' };
export const features = { localTrialWithoutEmail: true, hosting: true, artwork: true, github: true };
export function readySummary(draft) {
  const where = draft.target === 'remote' ? 'on Cloudflare' : 'on this computer';
  const name = draft.WORKSPACE_NAME || product.name;
  return `${name} is ready to be installed ${where}.${draft.OWNER_EMAIL ? ` Your owner account will use ${draft.OWNER_EMAIL}.` : ''}`;
}
