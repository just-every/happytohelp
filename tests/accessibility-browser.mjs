import assert from 'node:assert/strict';
import {createServer as createHttpServer} from 'node:http';
import {createServer as createNetServer} from 'node:net';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createRuntime} from './helpers/emitted-runtime.mjs';
import {createAxeAudit} from './helpers/accessibility-axe-audit.mjs';
import {createInteractionAudit} from './helpers/accessibility-interaction-audit.mjs';
import {runDashboardAccessibility} from './helpers/accessibility-dashboard-flow.mjs';
import {runWidgetAccessibility} from './helpers/accessibility-widget-flow.mjs';

const {chromium} = await import(process.env.H2H_PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(new URL('..', import.meta.url).pathname);
const evidenceDir = process.env.H2H_EVIDENCE_DIR
    ? resolve(process.env.H2H_EVIDENCE_DIR)
    : join(tmpdir(), 'h2h-accessibility-execution');
const axePath = join(root, 'node_modules/axe-core/axe.min.js');
await mkdir(evidenceDir, {recursive: true});

async function portIsFree(port) {
    const server = createNetServer();
    try {
        await new Promise((resolveListen, rejectListen) => {
            server.once('error', rejectListen);
            server.listen(port, '127.0.0.1', resolveListen);
        });
        await new Promise(resolveClose => server.close(resolveClose));
        return true;
    } catch {
        server.close();
        return false;
    }
}

async function selectRuntimePorts() {
    const ports = [8770, 8771, 8772, 8773, 8774, 8775, 8776, 8777, 8778, 8779];
    for (const port of [8770, 8772, 8774, 8776, 8778]) {
        const inspectorPort = port + 1;
        if (!await portIsFree(port) || !await portIsFree(inspectorPort)) continue;
        for (const hostPort of ports) {
            if (hostPort !== port && hostPort !== inspectorPort && await portIsFree(hostPort)) {
                return {port, inspectorPort, hostPort};
            }
        }
    }
    throw new Error('No free app/inspector/host ports in 8770-8779');
}

async function listen(server, port) {
    await new Promise((resolveListen, rejectListen) => {
        server.once('error', rejectListen);
        server.listen(port, '127.0.0.1', resolveListen);
    });
    return `http://127.0.0.1:${server.address().port}`;
}

const ports = await selectRuntimePorts();
// Local mail mode, as a local install runs it, so the widget offers its email notification explanation.
const runtime = await createRuntime({port: ports.port, inspectorPort: ports.inspectorPort, vars: {H2H_LOCAL: 'true', APP_ORIGIN: `http://127.0.0.1:${ports.port}`, EMAIL_PROVIDER: 'development', EMAIL_FROM: 'support@localhost.test'}});
let hostServer;
let browser;
let success = false;
const checks = [];
const scans = [];
const axeIncomplete = [];
const keyboard = [];
const layout = [];
const contrast = [];
const incompleteContrast = [];
const errors = [];
const failedResponses = [];
let widgetConfig;
let summary;

const bundle = await readFile(join(root, 'public/widget.js'));
hostServer = createHttpServer((request, response) => {
    if (request.url === '/widget.js') {
        response.writeHead(200, {'Content-Type': 'text/javascript; charset=utf-8'});
        response.end(bundle);
        return;
    }
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>HappyToHelp widget accessibility host</title></head><body><div id="happytohelp"></div><script src="/widget.js"></script><script>window.h2h('init', ${JSON.stringify(widgetConfig)});</script></body></html>`);
});
const hostOrigin = await listen(hostServer, ports.hostPort);

const call = async (path, body, token, headers = {}) => {
    const response = await fetch(runtime.origin + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}), ...headers},
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.ok(response.ok, `${path}: ${response.status} ${await response.clone().text()}`);
    return response.json();
};

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const axeAudit = createAxeAudit({axePath, evidenceDir, scans, axeIncomplete, incompleteContrast});
const interactionAudit = createInteractionAudit({evidenceDir, keyboard, layout, contrast});
const audit = {...axeAudit, ...interactionAudit};

try {
    browser = await chromium.launch({headless: true});
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
    widgetConfig = (await runDashboardAccessibility({browser, page, runtime, hostOrigin, call, axePath, audit, checks, errors, failedResponses, evidenceDir})).widgetConfig;
    await runWidgetAccessibility({browser, runtime, hostOrigin, widgetConfig, axePath, audit, checks, errors, failedResponses, evidenceDir});
    const buildHashes = {};
    for (const file of ['public/widget.js', 'dist/server/index.js']) {
        buildHashes[file] = createHash('sha256').update(await readFile(join(root, file))).digest('hex');
    }
    summary = {
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
        runtimePorts: {app: ports.port, inspector: ports.inspectorPort, host: ports.hostPort},
        appOrigin: runtime.origin,
        hostOrigin,
        browserVersion: browser.version(),
        axe: {version: '4.13.0', tags: wcagTags},
        buildHashes,
        checks,
        scans,
        axeIncomplete,
        keyboard,
        layout,
        incompleteContrast,
        errors,
        failedResponses,
        contrast,
    };
    await writeFile(join(evidenceDir, 'accessibility-browser-summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({checks, scans: scans.map(({label, violationCount}) => ({label, violationCount})), errors, failedResponses, layout: layout.map(({label, viewport, horizontalOverflow, surfaceHorizontalOverflow, targetsBelow24, targetsClipped, interactive}) => ({label, viewport, horizontalOverflow, surfaceHorizontalOverflow, smallTargets: targetsBelow24.length, clippedTargets: targetsClipped.length, unnamed: interactive.filter(item => !item.name).length})), incompleteContrast: incompleteContrast.map(({label, entries}) => ({label, count: entries.length, measured: entries.filter(item => item.status === 'measured').length, limited: entries.filter(item => item.status === 'limited').length, failed: entries.filter(item => item.status === 'failed').length, minimumContrastRatio: entries.filter(item => item.status === 'measured').reduce((minimum, item) => Math.min(minimum, item.minimumContrastRatio), Infinity)})), contrast: contrast.map(({label, measurements}) => ({label, count: measurements.length, failures: measurements.filter(item => (!item.found && !item.optional) || (item.found && (item.contrastRatio === null || item.contrastRatio < (item.minimum || 4.5)))).length}))}, null, 2));
    assert.deepEqual(errors, [], 'browser emitted page errors');
    success = true;
} finally {
    const cleanup = {browserClosed: !browser, hostServerClosed: !hostServer, workerClosed: false};
    const cleanupErrors = [];
    try {
        if (browser) await browser.close();
        cleanup.browserClosed = true;
    } catch (error) {
        cleanupErrors.push(`browser.close: ${error.message}`);
    }
    try {
        if (hostServer) await new Promise((resolveClose, rejectClose) => hostServer.close(error => error ? rejectClose(error) : resolveClose()));
        cleanup.hostServerClosed = true;
    } catch (error) {
        cleanupErrors.push(`hostServer.close: ${error.message}`);
    }
    try {
        await runtime.close(success);
        cleanup.workerClosed = true;
    } catch (error) {
        cleanupErrors.push(`runtime.close: ${error.message}`);
    }
    await writeFile(join(evidenceDir, 'process-cleanup.json'), JSON.stringify({
        timestamp: new Date().toISOString(),
        testSuccess: success,
        sourceCommit: summary?.sourceCommit || execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
        runtimePorts: summary?.runtimePorts || ports,
        buildHashes: summary?.buildHashes || null,
        cleanup,
        cleanupErrors,
    }, null, 2));
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors.map(message => new Error(message)), 'Accessibility audit process cleanup failed');
}
