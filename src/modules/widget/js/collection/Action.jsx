import { removePII } from "./Helper";

let lastAction = null;
//let lastActionTime = null;
let lastActionWriteTime = null;
let pendingActions = [];
let messageHandler = null;
let pendingTimer = false;
let pingTimer = false;
let pingTimerAction = false;
let analysisRetries = 0;
let lastSentTime = 0;
let widgetState = 'closed';
let collectorEnabled = true
let actionCallback = [];
let readyCallback = [];
let analysisCallback = [];
let isReady = false;

const ACTIVE_PING_INTERVAL = 50000;
const ACTION_PING_INTERVAL = 4100;
const MAX_ACTION_PING_INTERVAL = 60000;
const ANALYSIS_RETRIES = 5;
// Activity is batched: one visitor's tabs share a per-minute request allowance.
const SEND_INTERVAL = 2000;

// The server reports what happened to the activity it received. Only an analysis that
// was due but blocked by a running or just-finished one is asked for again, with backoff.
function handleAnalysis(result, retry = false) {
    const reason = result?.job?.reason;
    if(reason === 'queued') analysisCallback.forEach(fn => fn());
    if(reason !== 'schedule_gate') {
        clearTimeout(pingTimerAction);
        return;
    }
    if(!retry) analysisRetries = 0;
    if(analysisRetries >= ANALYSIS_RETRIES) return;
    clearTimeout(pingTimerAction);
    pingTimerAction = setTimeout(runPing, Math.min(ACTION_PING_INTERVAL * 2 ** analysisRetries, MAX_ACTION_PING_INTERVAL));
    analysisRetries++;
}

function sendPending() {
    if(messageHandler && pendingActions.length) {
        lastSentTime = Date.now();
        Promise.resolve(messageHandler('collector', pendingActions)).then(result => handleAnalysis(result));
        pendingActions = [];

        // Let any pending requests know we have sent context
        if(!isReady) {
            isReady = true;
            if(readyCallback.length > 0) {
                readyCallback.forEach(fn => fn());
                readyCallback = [];
            }
        }
    }
}

function sendPing(type) {
    if(messageHandler) {
        let sentPing = false;
        if(type === 'action' && widgetState !== 'opened' && collectorEnabled) {
            Promise.resolve(messageHandler('pingAction')).then(result => handleAnalysis(result, true));
            sentPing = true;
        }
        if(type === 'active') {
            messageHandler('pingActive');
            sentPing = true;
        }

        if(sentPing || !pingTimer) {
            // Send an active ping, if no action has been sent for a while to keep the connection alive
            if(pingTimer) clearTimeout(pingTimer);
            pingTimer = setTimeout(() => sendPing('active'), ACTIVE_PING_INTERVAL);
        }
    }
}

function writeAction(action, immediate = false, clean = false) {
    if (!collectorEnabled) return;
    if(!clean) action = removePII(action);
    let actionWriteTime = (new Date()).getTime();
    if(lastActionWriteTime && actionWriteTime <= lastActionWriteTime) {
        actionWriteTime = lastActionWriteTime + 1; // increase by a millisecond to keep order
    }
    lastActionWriteTime = actionWriteTime;
    pendingActions.push([actionWriteTime, action]);
    if(actionCallback.length > 0) {
        actionCallback.forEach(fn => fn(action, actionWriteTime));
    }
    if(messageHandler) {
        if(pendingTimer) clearTimeout(pendingTimer);
        if(immediate) {
            sendPending();
        }
        else {
            pendingTimer = setTimeout(sendPending, Math.max(50, lastSentTime + SEND_INTERVAL - Date.now()));
        }
    }
}

function recordAction(action, immediate = false, clean = false) {
    if (!collectorEnabled) return;
    action = action.charAt(0).toUpperCase() + action.slice(1);
    if(action === lastAction) return;
    lastAction = action;

    writeAction(action, immediate, clean);
}

function runPing() {
    sendPing('action');
}

function setMessageHandler(handler) {
    messageHandler = handler;
    if (!handler) { clearTimeout(pendingTimer); clearTimeout(pingTimer); clearTimeout(pingTimerAction); pendingActions = []; return; }
    sendPending();
    if(pingTimer) clearTimeout(pingTimer);
    pingTimer = setTimeout(() => sendPing('active'), ACTIVE_PING_INTERVAL);
}

function setWidgetState(newState) {
    widgetState = newState;
}

function setCollectorEnabled(newEnabled) {
    collectorEnabled = newEnabled;
    if (!newEnabled) { pendingActions = []; readyCallback = []; clearTimeout(pendingTimer); clearTimeout(pingTimer); clearTimeout(pingTimerAction); }
}

function onAction(fn) {
    actionCallback.push(fn);
    return () => { actionCallback = actionCallback.filter(callback => callback !== fn); };
}

function onAnalysisQueued(fn) {
    analysisCallback.push(fn);
    return () => { analysisCallback = analysisCallback.filter(callback => callback !== fn); };
}

function onReady(fn) {
    if(isReady || !collectorEnabled) {
        fn();
        return;
    }
    readyCallback.push(fn);
    return () => { readyCallback = readyCallback.filter(callback => callback !== fn); };
}

function resetCollectorState() {
    setMessageHandler(null);
    lastAction = null;
    lastActionWriteTime = null;
    pendingTimer = pingTimer = pingTimerAction = false;
    analysisRetries = 0;
    lastSentTime = 0;
    widgetState = 'closed';
    collectorEnabled = false;
    actionCallback = [];
    readyCallback = [];
    analysisCallback = [];
    isReady = false;
}

export {
    resetCollectorState,
    lastAction,
    writeAction,
    recordAction,
    sendPing,
    setMessageHandler,
    setWidgetState,
    setCollectorEnabled,
    onAction,
    onAnalysisQueued,
    onReady,
};
