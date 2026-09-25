let globalLoggers = [];
export function setEnsembleLogger(logger) {
    if (logger === null) {
        globalLoggers = [];
    }
    else {
        if (!globalLoggers.includes(logger)) {
            globalLoggers.push(logger);
        }
    }
}
export function addEnsembleLogger(logger) {
    if (!globalLoggers.includes(logger)) {
        globalLoggers.push(logger);
    }
}
export function removeEnsembleLogger(logger) {
    const index = globalLoggers.indexOf(logger);
    if (index > -1) {
        globalLoggers.splice(index, 1);
    }
}
export function getEnsembleLogger() {
    return globalLoggers[0] || null;
}
export function getAllEnsembleLoggers() {
    return [...globalLoggers];
}
export function log_llm_request(agentId, providerName, model, requestData, timestamp, requestId, tags) {
    const requestIds = [];
    for (const logger of globalLoggers) {
        try {
            const loggerRequestId = logger.log_llm_request(agentId, providerName, model, requestData, timestamp, requestId, tags);
            if (loggerRequestId) {
                requestIds.push(loggerRequestId);
            }
        }
        catch (error) {
            console.error('Error in logger.log_llm_request:', error);
        }
    }
    return requestIds[0] || requestId || '';
}
export function log_llm_response(requestId, responseData, timestamp) {
    for (const logger of globalLoggers) {
        try {
            logger.log_llm_response(requestId, responseData, timestamp);
        }
        catch (error) {
            console.error('Error in logger.log_llm_response:', error);
        }
    }
}
export function log_llm_error(requestId, errorData, timestamp) {
    for (const logger of globalLoggers) {
        try {
            logger.log_llm_error(requestId, errorData, timestamp);
        }
        catch (error) {
            console.error('Error in logger.log_llm_error:', error);
        }
    }
}
