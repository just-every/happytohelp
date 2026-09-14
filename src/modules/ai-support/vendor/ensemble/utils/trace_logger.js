let globalTraceLoggers = [];
const turnSequenceMap = new Map();
function nextSequence(turnId) {
    const next = (turnSequenceMap.get(turnId) || 0) + 1;
    turnSequenceMap.set(turnId, next);
    return next;
}
export function setEnsembleTraceLogger(logger) {
    if (logger === null) {
        globalTraceLoggers = [];
        turnSequenceMap.clear();
    }
    else if (!globalTraceLoggers.includes(logger)) {
        globalTraceLoggers.push(logger);
    }
}
export function addEnsembleTraceLogger(logger) {
    if (!globalTraceLoggers.includes(logger)) {
        globalTraceLoggers.push(logger);
    }
}
export function removeEnsembleTraceLogger(logger) {
    const index = globalTraceLoggers.indexOf(logger);
    if (index > -1) {
        globalTraceLoggers.splice(index, 1);
    }
}
export function getEnsembleTraceLogger() {
    return globalTraceLoggers[0] || null;
}
export function getAllEnsembleTraceLoggers() {
    return [...globalTraceLoggers];
}
export async function emitTraceEvent(event) {
    if (globalTraceLoggers.length === 0) {
        return;
    }
    const sequence = event.sequence ?? nextSequence(event.turn_id);
    const timestamp = event.timestamp || new Date().toISOString();
    const finalEvent = {
        ...event,
        sequence,
        timestamp,
    };
    const calls = globalTraceLoggers.map(async (logger) => {
        try {
            await logger.log_trace_event(finalEvent);
        }
        catch (error) {
            console.error('Error in logger.log_trace_event:', error);
        }
    });
    await Promise.all(calls);
    if (event.type === 'turn_end') {
        turnSequenceMap.delete(event.turn_id);
    }
}
