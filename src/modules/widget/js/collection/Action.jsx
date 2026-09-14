import { removePII } from "./Helper";

let lastAction = null;
//let lastActionTime = null;
let lastActionWriteTime = null;
let pendingActions = [];
let messageHandler = null;
let pendingTimer = false;
let pingTimer = false;
let pingTimerAction = false;
let sentActionPing = false;
let sentActions = 0;
let widgetState = 'closed';
let collectorEnabled = true
let actionCallback = [];
let readyCallback = [];
let isReady = false;

const ACTIVE_PING_INTERVAL = 50000;
const ACTION_PING_INTERVAL = 4100;

function sendPending() {
    if(messageHandler && pendingActions.length) {
        sentActions += pendingActions.length;
        messageHandler('collector', pendingActions);
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
        if(type === 'action' && sentActions > 0 && widgetState !== 'opened' && collectorEnabled) {
            messageHandler('pingAction');
            sentActions = 0;
            sentActionPing = true;
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
            pendingTimer = setTimeout(sendPending, 50);
        }
    }
}

function recordAction(action, immediate = false, clean = false) {
    action = action.charAt(0).toUpperCase() + action.slice(1);
    if(action === lastAction) return;
    lastAction = action;

    writeAction(action, immediate, clean);
}

function runPing() {
    sendPing('action');
    if(pingTimerAction) clearTimeout(pingTimerAction);
    pingTimerAction = setTimeout(runPing, ACTION_PING_INTERVAL);
}

function setMessageHandler(handler) {
    messageHandler = handler;
    if (!handler) { clearTimeout(pendingTimer); clearTimeout(pingTimer); clearTimeout(pingTimerAction); pendingActions = []; return; }
    sendPending();
    if(!sentActionPing && collectorEnabled) {
        runPing();
    }
    else {
        if(pingTimer) clearTimeout(pingTimer);
        pingTimer = setTimeout(() => sendPing('active'), ACTIVE_PING_INTERVAL);
    }
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
}

function onReady(fn) {
    if(isReady || !collectorEnabled) {
        fn();
        return;
    }
    readyCallback.push(fn);
}

export {
    lastAction,
    writeAction,
    recordAction,
    sendPing,
    setMessageHandler,
    setWidgetState,
    setCollectorEnabled,
    onAction,
    onReady,
};
