import { MAX_RESULT_LENGTH, SKIP_SUMMARIZATION_TOOLS, TOOL_CONFIGS } from '../config/tool_execution.js';
import crypto from 'node:crypto';
import { durableFiles as fs } from '../worker-runtime.js';
import path from 'node:path';
const SUMMARIZE_AT_CHARS = 5000;
const SUMMARIZE_TRUNCATE_CHARS = 200000;
const summaryCache = new Map();
const CACHE_EXPIRATION_MS = 60 * 60 * 1000;
const HASH_MAP_FILENAME = 'summary_hash_map.json';
async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    }
    catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}
async function loadHashMap(file_path) {
    try {
        const data = await fs.readFile(file_path, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
        console.error(`Error loading summary hash map from ${file_path}:`, error);
        return {};
    }
}
async function saveHashMap(file_path, map) {
    try {
        const data = JSON.stringify(map, null, 2);
        await fs.writeFile(file_path, data, 'utf-8');
    }
    catch (error) {
        console.error(`Error saving summary hash map to ${file_path}:`, error);
    }
}
const agentsWithSummaryTools = new Set();
const FAILURE_PATTERNS = [
    /error|exception|failed|timeout|rejected|unable to|cannot|not found|invalid/gi,
    /retry.*attempt|retrying|trying again/gi,
    /no (?:such|valid) (?:file|directory|path|route)/gi,
    /unexpected|unknown|unhandled/gi,
];
const MAX_RETRIES = 3;
const ERROR_FREQUENCY_THRESHOLD = 0.3;
function truncate(text, length = SUMMARIZE_TRUNCATE_CHARS, separator = '\n\n...[truncated for summary]...\n\n', simpleMode = false) {
    text = text.trim();
    if (typeof separator !== 'string' || separator.length === 0) {
        separator = '\n\n...[truncated for summary]...\n\n';
    }
    if (text.length <= length) {
        return text;
    }
    if (simpleMode) {
        return text.substring(0, length);
    }
    const beginLength = Math.floor(length * 0.3);
    const endLength = length - beginLength - separator.length;
    return text.substring(0, beginLength) + separator + text.substring(text.length - endLength);
}
export async function createSummary(content, prompt, agent) {
    if (content.length <= SUMMARIZE_AT_CHARS) {
        return content;
    }
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    const cacheKey = `${contentHash}-${prompt.substring(0, 50)}`;
    const cachedSummary = summaryCache.get(cacheKey);
    if (cachedSummary &&
        Date.now() - cachedSummary.timestamp < CACHE_EXPIRATION_MS &&
        !agent) {
        console.log(`Retrieved summary from cache for hash: ${contentHash.substring(0, 8)}...`);
        return cachedSummary.summary;
    }
    if (agent) {
        return createExpandableSummary(content, prompt, agent);
    }
    try {
        const truncatedContent = truncate(content, SUMMARIZE_TRUNCATE_CHARS);
        const originalLines = content.split('\n').length;
        const { ensembleRequest } = await import('../core/ensemble_request.js');
        const messages = [
            {
                type: 'message',
                role: 'system',
                content: prompt,
            },
            {
                type: 'message',
                role: 'user',
                content: truncatedContent,
            },
        ];
        const summaryAgent = {
            modelClass: 'summary',
            name: 'SummaryAgent',
        };
        let summary = '';
        for await (const event of ensembleRequest(messages, summaryAgent)) {
            if (event.type === 'message_complete' && 'content' in event) {
                summary += event.content;
            }
        }
        if (!summary) {
            throw new Error('No summary generated');
        }
        const trimmedSummary = summary.trim();
        const summaryLines = trimmedSummary.split('\n').length;
        const metadata = `\n\n[Summarized output: ${originalLines} → ${summaryLines} lines, ${content.length} → ${trimmedSummary.length} chars]`;
        const fullSummary = trimmedSummary + metadata;
        if (!agent) {
            summaryCache.set(cacheKey, {
                summary: fullSummary,
                timestamp: Date.now(),
            });
        }
        return fullSummary;
    }
    catch (error) {
        console.error('Error creating summary:', error);
        const truncated = truncate(content, MAX_RESULT_LENGTH);
        return truncated + '\n\n[Summary generation failed, output truncated]';
    }
}
async function createExpandableSummary(content, prompt, agent) {
    const summariesDir = './summaries';
    await ensureDir(summariesDir);
    const hashMapPath = path.join(summariesDir, HASH_MAP_FILENAME);
    const documentHash = crypto.createHash('sha256').update(content).digest('hex');
    const hashMap = await loadHashMap(hashMapPath);
    if (hashMap[documentHash]) {
        const summaryId = hashMap[documentHash];
        const summaryFilePath = path.join(summariesDir, `summary-${summaryId}.txt`);
        const originalFilePath = path.join(summariesDir, `original-${summaryId}.txt`);
        try {
            const [existingSummary, originalDoc] = await Promise.all([
                fs.readFile(summaryFilePath, 'utf-8'),
                fs.readFile(originalFilePath, 'utf-8'),
            ]);
            const originalLines = originalDoc.split('\n').length;
            const summaryLines = existingSummary.split('\n').length;
            const originalChars = originalDoc.length;
            const summaryChars = existingSummary.length;
            console.log(`Retrieved expandable summary from cache for hash: ${documentHash.substring(0, 8)}...`);
            await injectSummaryTools(agent);
            const metadata = `\n\nSummarized large output to avoid excessive tokens (${originalLines} -> ${summaryLines} lines, ${originalChars} -> ${summaryChars} chars) [Write to file with write_source(${summaryId}, file_path) or read with read_source(${summaryId}, line_start, line_end)]`;
            return existingSummary.trim() + metadata;
        }
        catch (error) {
            console.error(`Error reading cached summary files for ID ${summaryId}:`, error);
            delete hashMap[documentHash];
            await saveHashMap(hashMapPath, hashMap);
        }
    }
    const originalDocumentForSave = content;
    const originalLines = originalDocumentForSave.split('\n').length;
    const truncatedContent = truncate(content, SUMMARIZE_TRUNCATE_CHARS);
    try {
        const { ensembleRequest } = await import('../core/ensemble_request.js');
        const messages = [
            {
                type: 'message',
                role: 'system',
                content: prompt,
            },
            {
                type: 'message',
                role: 'user',
                content: truncatedContent,
            },
        ];
        const summaryAgent = {
            modelClass: 'summary',
            name: 'SummaryAgent',
        };
        let summary = '';
        for await (const event of ensembleRequest(messages, summaryAgent)) {
            if (event.type === 'message_complete' && 'content' in event) {
                summary += event.content;
            }
        }
        if (!summary) {
            throw new Error('No summary generated');
        }
        const trimmedSummary = summary.trim();
        const summaryLines = trimmedSummary.split('\n').length;
        const newSummaryId = crypto.randomUUID();
        const summaryFilePath = path.join(summariesDir, `summary-${newSummaryId}.txt`);
        const originalFilePath = path.join(summariesDir, `original-${newSummaryId}.txt`);
        try {
            await Promise.all([
                fs.writeFile(summaryFilePath, trimmedSummary, 'utf-8'),
                fs.writeFile(originalFilePath, originalDocumentForSave, 'utf-8'),
            ]);
            hashMap[documentHash] = newSummaryId;
            await saveHashMap(hashMapPath, hashMap);
            console.log(`Saved new expandable summary with ID: ${newSummaryId} for hash: ${documentHash.substring(0, 8)}...`);
        }
        catch (error) {
            console.error(`Error saving new summary files for ID ${newSummaryId}:`, error);
            return trimmedSummary;
        }
        const originalChars = originalDocumentForSave.length;
        const summaryChars = trimmedSummary.length;
        await injectSummaryTools(agent);
        const metadata = `\n\nSummarized large output to avoid excessive tokens (${originalLines} -> ${summaryLines} lines, ${originalChars} -> ${summaryChars} chars) [Write to file with write_source(${newSummaryId}, file_path) or read with read_source(${newSummaryId}, line_start, line_end)]`;
        return trimmedSummary + metadata;
    }
    catch (error) {
        console.error('Error creating expandable summary:', error);
        const truncated = truncate(content, MAX_RESULT_LENGTH);
        return truncated + '\n\n[Summary generation failed, output truncated]';
    }
}
async function injectSummaryTools(agent) {
    const agentId = agent.agent_id || 'unknown';
    if (agentsWithSummaryTools.has(agentId)) {
        return;
    }
    const { getSummaryTools } = await import('./summary_utils.js');
    const summaryTools = getSummaryTools();
    if (!agent.tools) {
        agent.tools = [];
    }
    const hasReadSource = agent.tools.some(tool => tool.definition.function.name === 'read_source');
    const hasWriteSource = agent.tools.some(tool => tool.definition.function.name === 'write_source');
    if (!hasReadSource) {
        agent.tools.push(summaryTools[0]);
    }
    if (!hasWriteSource) {
        agent.tools.push(summaryTools[1]);
    }
    agentsWithSummaryTools.add(agentId);
    console.log(`Injected summary tools into agent ${agentId}`);
}
export async function processToolResult(toolCall, rawResult, agent, allowSummary) {
    const toolName = toolCall.function.name;
    const config = TOOL_CONFIGS[toolName] || {};
    if (rawResult.includes('data:image/')) {
        return rawResult;
    }
    if (allowSummary === false) {
        return rawResult;
    }
    const skipSummarization = config.skipSummarization || SKIP_SUMMARIZATION_TOOLS.has(toolName);
    const maxLength = config.maxLength || MAX_RESULT_LENGTH;
    if (skipSummarization) {
        if (rawResult.length > maxLength) {
            const useSimpleMode = rawResult.includes('data:image/');
            const truncatedResult = truncate(rawResult, maxLength, undefined, useSimpleMode);
            const truncationMessage = config.truncationMessage || `\n\n[Output truncated: ${rawResult.length} → ${maxLength} chars]`;
            return truncatedResult + truncationMessage;
        }
        return rawResult;
    }
    const summarizeThreshold = Math.max(maxLength, SUMMARIZE_AT_CHARS);
    if (rawResult.length <= summarizeThreshold) {
        return rawResult;
    }
    const potentialIssues = detectPotentialIssues(rawResult);
    let summaryPrompt = `The following is the output of a tool call \`${toolName}(${toolCall.function.arguments})\` used by an AI agent in an autonomous system. Focus on summarizing both the overall output and the final result of the tool. Your summary will be used to understand what the result of the tool call was.`;
    if (potentialIssues.isLikelyFailing) {
        summaryPrompt += ` Note: The output appears to contain errors or issues. Please highlight any errors, failures, or problems in your summary.`;
    }
    const summary = await createSummary(rawResult, summaryPrompt, agent);
    if (potentialIssues.isLikelyFailing && potentialIssues.issues.length > 0) {
        return summary + `\n\n⚠️ Potential issues detected: ${potentialIssues.issues.join(', ')}`;
    }
    return summary;
}
export function shouldSummarizeResult(toolName, resultLength) {
    const config = TOOL_CONFIGS[toolName] || {};
    if (config.skipSummarization || SKIP_SUMMARIZATION_TOOLS.has(toolName)) {
        return false;
    }
    const maxLength = config.maxLength || MAX_RESULT_LENGTH;
    return resultLength > maxLength;
}
export function getTruncationMessage(toolName) {
    const config = TOOL_CONFIGS[toolName] || {};
    return config.truncationMessage || `... Output truncated to ${config.maxLength || MAX_RESULT_LENGTH} characters`;
}
function detectPotentialIssues(output) {
    if (!output) {
        return { isLikelyFailing: false, issues: [] };
    }
    let errorCount = 0;
    let retryCount = 0;
    const issues = [];
    FAILURE_PATTERNS.forEach(pattern => {
        const matches = output.match(pattern);
        if (matches) {
            errorCount += matches.length;
        }
    });
    const retryMatches = output.match(/retry.*attempt|retrying|trying again/gi);
    if (retryMatches) {
        retryCount += retryMatches.length;
    }
    const errorFrequency = output.length > 0 ? errorCount / output.length : 0;
    const isLikelyFailing = retryCount > MAX_RETRIES || errorFrequency > ERROR_FREQUENCY_THRESHOLD;
    if (retryCount > MAX_RETRIES) {
        issues.push(`excessive retries (${retryCount})`);
    }
    if (errorFrequency > ERROR_FREQUENCY_THRESHOLD) {
        issues.push(`high error frequency (${(errorFrequency * 100).toFixed(1)}%)`);
    }
    return { isLikelyFailing, issues };
}
export function clearSummaryCache() {
    summaryCache.clear();
}
export function getSummaryCacheStats() {
    let oldestTimestamp = null;
    summaryCache.forEach(({ timestamp }) => {
        if (oldestTimestamp === null || timestamp < oldestTimestamp) {
            oldestTimestamp = timestamp;
        }
    });
    return {
        size: summaryCache.size,
        oldestEntry: oldestTimestamp,
    };
}
