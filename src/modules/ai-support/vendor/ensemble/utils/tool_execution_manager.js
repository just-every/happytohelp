import { v4 as uuidv4 } from 'uuid';
import { runningToolTracker } from './running_tool_tracker.js';
import { runSequential } from './sequential_queue.js';
import { coerceValue } from './tool_parameter_utils.js';
import { FUNCTION_TIMEOUT_MS, EXCLUDED_FROM_TIMEOUT_FUNCTIONS, STATUS_TRACKING_TOOLS, } from '../config/tool_execution.js';
const MIN_TOOL_TIMEOUT_MS = 1000;
const MAX_TOOL_TIMEOUT_MS = 900000;
function convertResultToString(result) {
    if (result === null || result === undefined) {
        return '';
    }
    if (typeof result === 'string') {
        return result;
    }
    if (typeof result === 'number' || typeof result === 'boolean') {
        return result.toString();
    }
    if (result instanceof Error) {
        return String(result);
    }
    if (typeof result === 'object') {
        try {
            return JSON.stringify(result, null, 2);
        }
        catch (error) {
            console.warn('Failed to JSON.stringify tool result, falling back to String():', error);
            return String(result);
        }
    }
    return String(result);
}
export function timeoutPromise(ms) {
    return new Promise(resolve => {
        setTimeout(() => resolve('TIMEOUT'), ms);
    });
}
export function agentHasStatusTracking(agent) {
    if (!agent.tools)
        return false;
    return agent.tools.some(tool => STATUS_TRACKING_TOOLS.has(tool.definition.function.name));
}
function resolveConfiguredToolTimeoutMs(agent) {
    const raw = agent.modelSettings?.tool_timeout_ms;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return Math.max(MIN_TOOL_TIMEOUT_MS, Math.min(MAX_TOOL_TIMEOUT_MS, Math.floor(parsed)));
}
function resolveToolTimeoutBehavior(agent, hasStatusTracking) {
    const raw = String(agent.modelSettings?.tool_timeout_behavior || '')
        .trim()
        .toLowerCase();
    if (raw === 'background')
        return 'background';
    if (raw === 'error')
        return 'error';
    return hasStatusTracking ? 'background' : 'error';
}
export async function executeToolWithLifecycle(toolCall, tool, agent, signal) {
    const fnId = toolCall.id || uuidv4();
    const toolName = toolCall.function.name;
    const argsString = toolCall.function.arguments || '{}';
    let args;
    try {
        args = prepareToolArguments(argsString, tool);
    }
    catch (error) {
        throw new Error(`Invalid JSON in tool arguments: ${error}`, { cause: error });
    }
    const runningTool = runningToolTracker.addRunningTool(fnId, toolName, agent.agent_id || 'unknown', argsString);
    const trackerAbortController = runningTool.abortController;
    const abortSignal = trackerAbortController?.signal;
    const propagateAbort = () => {
        if (!trackerAbortController || trackerAbortController.signal.aborted) {
            return;
        }
        trackerAbortController.abort(signal?.reason ?? new Error('Operation was aborted'));
    };
    if (signal?.aborted) {
        propagateAbort();
    }
    else if (signal) {
        signal.addEventListener('abort', propagateAbort, { once: true });
    }
    try {
        if (abortSignal?.aborted) {
            throw abortSignal.reason ?? new Error('Operation was aborted');
        }
        if (tool.injectAgentId) {
            args.unshift(agent.agent_id || 'ensemble');
        }
        if (tool.injectAbortSignal && abortSignal) {
            args.push(abortSignal);
        }
        const result = await tool.function(...args);
        const resultString = convertResultToString(result);
        await runningToolTracker.completeRunningTool(fnId, resultString, agent);
        return resultString;
    }
    catch (error) {
        const errorString = convertResultToString(error);
        await runningToolTracker.failRunningTool(fnId, errorString, agent);
        throw error;
    }
    finally {
        if (signal) {
            signal.removeEventListener('abort', propagateAbort);
        }
    }
}
export async function handleToolCall(toolCall, tool, agent, signal) {
    const fnId = toolCall.id || uuidv4();
    const toolName = toolCall.function.name;
    const executeFunction = async () => {
        if (toolName === 'wait_for_running_tool') {
            return executeToolWithLifecycle(toolCall, tool, agent, signal);
        }
        if (!tool.injectAbortSignal) {
            return executeToolWithLifecycle(toolCall, tool, agent, signal);
        }
        return Promise.race([
            executeToolWithLifecycle(toolCall, tool, agent, signal),
            new Promise((_, reject) => {
                const runningTool = runningToolTracker.getRunningTool(fnId);
                if (runningTool?.abortController?.signal) {
                    runningTool.abortController.signal.addEventListener('abort', () => reject(new Error('Operation was aborted')), { once: true });
                }
            }),
        ]);
    };
    const sequential = !!agent.modelSettings?.sequential_tools;
    const hasStatusTools = agentHasStatusTracking(agent);
    const excludedFromTimeout = EXCLUDED_FROM_TIMEOUT_FUNCTIONS.has(toolName);
    const configuredTimeoutMs = resolveConfiguredToolTimeoutMs(agent);
    const timeoutBehavior = resolveToolTimeoutBehavior(agent, hasStatusTools);
    const timeoutMs = configuredTimeoutMs ?? FUNCTION_TIMEOUT_MS;
    const shouldTimeout = !excludedFromTimeout && !sequential && (hasStatusTools || configuredTimeoutMs !== null);
    const execute = sequential ? () => runSequential(agent.agent_id || 'unknown', executeFunction) : executeFunction;
    if (!shouldTimeout) {
        return execute();
    }
    const executionPromise = execute();
    executionPromise.catch(() => { });
    const result = await Promise.race([executionPromise, timeoutPromise(timeoutMs)]);
    if (result === 'TIMEOUT') {
        runningToolTracker.markTimedOut(fnId);
        if (typeof runningToolTracker.abortRunningTool === 'function') {
            runningToolTracker.abortRunningTool(fnId);
        }
        const timeoutMessage = `Tool ${toolName} timed out after ${timeoutMs}ms`;
        if (timeoutBehavior === 'background') {
            return `Tool ${toolName} is running in the background (RunningTool: ${fnId}).`;
        }
        await runningToolTracker.failRunningTool(fnId, timeoutMessage, agent);
        throw new Error(timeoutMessage);
    }
    return result;
}
export function prepareToolArguments(argsString, tool) {
    let args;
    try {
        if (!argsString || argsString.trim() === '') {
            args = {};
        }
        else {
            args = JSON.parse(argsString);
        }
    }
    catch (error) {
        throw new Error(`Invalid JSON in tool arguments: ${error}`, { cause: error });
    }
    if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
        const paramNames = Object.keys(tool.definition.function.parameters.properties);
        Object.keys(args).forEach(key => {
            if (!paramNames.includes(key)) {
                console.warn(`Removing unknown parameter "${key}" for tool "${tool.definition.function.name}"`);
                delete args[key];
            }
        });
        if (paramNames.length > 0) {
            return paramNames.map(param => {
                const value = args[param];
                const paramSpec = tool.definition.function.parameters.properties[param];
                if ((value === undefined || value === '') &&
                    !tool.definition.function.parameters.required?.includes(param)) {
                    return undefined;
                }
                const [coercedValue, error] = coerceValue(value, paramSpec, param);
                if (error && tool.definition.function.parameters.required?.includes(param)) {
                    throw new Error(JSON.stringify({
                        error: {
                            param,
                            expected: paramSpec.type + (paramSpec.items?.type ? `<${paramSpec.items.type}>` : ''),
                            received: String(value),
                            message: error,
                        },
                    }));
                }
                else if (error) {
                    console.warn(`Parameter coercion warning for ${param}: ${error}`);
                }
                return coercedValue;
            });
        }
        return Object.values(args);
    }
    return [args];
}
