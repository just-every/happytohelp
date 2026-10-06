import { execFileSync } from 'node:child_process';
import { accessSync, constants, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { digest, invariant, safeText } from './custody.mjs';

export const prerequisiteNames = ['localGate', 'acceptedT021', 'workflowController', 'environmentPolicy',
  'throwawayAccount', 'testDomain', 'verifiedSender', 'inboundParse', 'testMailbox',
  'deliveryEventAccess', 'modelAccessAndCap', 'spendApproval', 'ownerInteraction', 'captureApproval'];
export const milestones = ['deployment', 'fresh-storage', 'owner-setup', 'empty-checklist',
  'sender-dns', 'owner-mail-delivered', 'inbound-receipt', 'model-key', 'spend-ceilings',
  'published-article', 'default-assistant', 'widget-origin', 'widget-installed', 'widget-ping',
  'visitor-question', 'first-cited-answer', 'operator-transcript', 'citation-target',
  'reload-survival', 'capture-1440', 'capture-390', 'model-usage', 'final-checklist'];

export function command(spec, label) {
  invariant(spec && isAbsolute(spec.executable) && Array.isArray(spec.args) && spec.args.every(x => typeof x === 'string'), `${label}: absolute executable and string args required`);
  invariant(isAbsolute(spec.cwd) && statSync(spec.cwd).isDirectory(), `${label}: explicit existing cwd required`);
  invariant(!('env' in spec), `${label}: credentials must be supplied blind by root, never in config`);
  safeText(spec);
  accessSync(spec.executable, constants.X_OK);
  return spec;
}

export function loadConfig(path) {
  const bytes = readFileSync(path);
  const config = JSON.parse(safeText(bytes.toString()));
  invariant(config.version === 1 && /^[a-z0-9][a-z0-9-]{5,70}$/.test(config.attempt), 'Unique attempt name and version=1 required');
  invariant(/^[a-f0-9]{40}$/.test(config.sourceSha), 'Exact source SHA required');
  invariant(config.authorization === 'root-authorized-real-run', 'Root live-run authorization is required');
  invariant(isAbsolute(config.repository), 'Absolute source checkout required');
  const root = realpathSync(config.repository);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  invariant(sha === config.sourceSha, 'Source checkout HEAD differs from approved SHA');
  invariant(!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim(), 'Tracked checkout is dirty');
  for (const name of ['capture', 'installer']) command(config[name], name);
  for (const name of ['ffmpeg', 'ffprobe']) {
    invariant(isAbsolute(config[name]), `${name} must be an absolute executable path`);
    accessSync(config[name], constants.X_OK);
  }
  invariant(config.captureDescription && config.prerequisiteDisclosure && config.redactionPolicy, 'Describe actual screen source, pre-existing accounts/domains, and privacy masking');
  invariant(config.maxSeconds === 900, 'Timing threshold must remain 900 seconds');
  const receipts = {};
  for (const name of prerequisiteNames) {
    const p = config.prerequisites?.[name];
    invariant(p && isAbsolute(p), `Missing prerequisite receipt: ${name}`);
    invariant(statSync(p).isFile() && statSync(p).size < 1_000_000, `Invalid prerequisite receipt: ${name}`);
    const text = safeText(readFileSync(p, 'utf8'));
    invariant(text.trim().length > 20, `Empty prerequisite receipt: ${name}`);
    receipts[name] = { path: p, sha256: digest(text), bytes: text };
  }
  const origin = new URL(config.origin);
  invariant(origin.protocol === 'https:' && origin.origin === config.origin && !origin.username && !origin.password, 'Exact approved HTTPS installation origin required');
  const output = resolve(root, 'verification/t-022/attempts', config.attempt);
  return { config, receipts, output, configHash: digest(JSON.stringify(config)) };
}
