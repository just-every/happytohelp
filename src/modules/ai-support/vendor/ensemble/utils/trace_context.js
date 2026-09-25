import { randomUUID } from 'node:crypto';
import { emitTraceEvent } from './trace_logger.js';
export class TraceContext {
    agent;
    operation;
    turnId;
    requestCount = 0;
    requestNumbers = new Map();
    constructor(agent, operation, turnId) {
        this.agent = agent;
        this.operation = operation;
        this.turnId = turnId || randomUUID();
    }
    getEventAgentId() {
        if (this.agent.agent_id === undefined) {
            return {};
        }
        return { agent_id: this.agent.agent_id };
    }
    async emitTurnStart(data) {
        await emitTraceEvent({
            type: 'turn_start',
            turn_id: this.turnId,
            ...this.getEventAgentId(),
            data: {
                operation: this.operation,
                agent_id: this.agent.agent_id,
                name: this.agent.name,
                model: this.agent.model,
                model_class: this.agent.modelClass,
                ...data,
            },
        });
    }
    async emitRequestStart(requestId, data) {
        this.requestCount += 1;
        this.requestNumbers.set(requestId, this.requestCount);
        await emitTraceEvent({
            type: 'request_start',
            turn_id: this.turnId,
            ...this.getEventAgentId(),
            request_id: requestId,
            data: {
                request_number: this.requestCount,
                ...data,
            },
        });
        return this.requestCount;
    }
    async emitToolStart(requestId, toolCallId, data) {
        await emitTraceEvent({
            type: 'tool_start',
            turn_id: this.turnId,
            ...this.getEventAgentId(),
            request_id: requestId,
            tool_call_id: toolCallId,
            data,
        });
    }
    async emitToolDone(requestId, toolCallId, data) {
        await emitTraceEvent({
            type: 'tool_done',
            turn_id: this.turnId,
            ...this.getEventAgentId(),
            request_id: requestId,
            tool_call_id: toolCallId,
            data,
        });
    }
    async emitRequestEnd(requestId, data) {
        const requestNumber = requestId ? this.requestNumbers.get(requestId) : undefined;
        await emitTraceEvent({
            type: 'request_end',
            turn_id: this.turnId,
            ...this.getEventAgentId(),
            request_id: requestId,
            data: {
                request_number: requestNumber,
                ...data,
            },
        });
    }
    async emitTurnEnd(status, reason, data) {
        await emitTraceEvent({
            type: 'turn_end',
            turn_id: this.turnId,
            ...this.getEventAgentId(),
            data: {
                status,
                reason,
                request_count: this.requestCount,
                ...data,
            },
        });
    }
    getRequestCount() {
        return this.requestCount;
    }
}
export function createTraceContext(agent, operation, turnId) {
    return new TraceContext(agent, operation, turnId);
}
