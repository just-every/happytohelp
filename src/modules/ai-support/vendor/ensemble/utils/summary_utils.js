import { durableFiles as fs } from '../worker-runtime.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { createToolFunction } from './create_tool_function.js';
const SUMMARIZE_AT_CHARS = 5000;
const SUMMARIZE_TRUNCATE_CHARS = 200000;
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
function truncate(text, length = SUMMARIZE_TRUNCATE_CHARS, separator = '\n\n...[truncated for summary]...\n\n') {
    text = text.trim();
    if (text.length <= length) {
        return text;
    }
    return text.substring(0, length * 0.3) + separator + text.substring(text.length - length * 0.7 + separator.length);
}
export async function createSummary(document, context, summaryFn, includeExpansionReferences = false, summariesDir) {
    if (document.length <= SUMMARIZE_AT_CHARS) {
        return document;
    }
    const finalSummariesDir = summariesDir || './summaries';
    await ensureDir(finalSummariesDir);
    const hashMapPath = path.join(finalSummariesDir, HASH_MAP_FILENAME);
    const documentHash = crypto.createHash('sha256').update(document).digest('hex');
    const hashMap = await loadHashMap(hashMapPath);
    if (hashMap[documentHash]) {
        const summaryId = hashMap[documentHash];
        const summaryFilePath = path.join(finalSummariesDir, `summary-${summaryId}.txt`);
        const originalFilePath = path.join(finalSummariesDir, `original-${summaryId}.txt`);
        try {
            const [existingSummary, originalDoc] = await Promise.all([
                fs.readFile(summaryFilePath, 'utf-8'),
                fs.readFile(originalFilePath, 'utf-8'),
            ]);
            const originalLines = originalDoc.split('\n').length;
            const summaryLines = existingSummary.split('\n').length;
            const originalChars = originalDoc.length;
            const summaryChars = existingSummary.length;
            const metadata = includeExpansionReferences
                ? `\n\nSummarized large output to avoid excessive tokens (${originalLines} -> ${summaryLines} lines, ${originalChars} -> ${summaryChars} chars) [Write to file with write_source(${summaryId}, file_path) or read with read_source(${summaryId}, line_start, line_end)]`
                : `\n\nSummarized large output to avoid excessive tokens (${originalLines} -> ${summaryLines} lines, ${originalChars} -> ${summaryChars} chars)`;
            console.log(`Retrieved summary from cache for hash: ${documentHash.substring(0, 8)}...`);
            return existingSummary.trim() + metadata;
        }
        catch (error) {
            console.error(`Error reading cached summary files for ID ${summaryId}:`, error);
            delete hashMap[documentHash];
            await saveHashMap(hashMapPath, hashMap);
        }
    }
    const originalDocumentForSave = document;
    const originalLines = originalDocumentForSave.split('\n').length;
    document = truncate(document);
    const summary = await summaryFn(document, context);
    const trimmedSummary = summary.trim();
    const summaryLines = trimmedSummary.split('\n').length;
    const newSummaryId = crypto.randomUUID();
    const summaryFilePath = path.join(finalSummariesDir, `summary-${newSummaryId}.txt`);
    const originalFilePath = path.join(finalSummariesDir, `original-${newSummaryId}.txt`);
    try {
        await Promise.all([
            fs.writeFile(summaryFilePath, trimmedSummary, 'utf-8'),
            fs.writeFile(originalFilePath, originalDocumentForSave, 'utf-8'),
        ]);
        hashMap[documentHash] = newSummaryId;
        await saveHashMap(hashMapPath, hashMap);
        console.log(`Saved new summary with ID: ${newSummaryId} for hash: ${documentHash.substring(0, 8)}...`);
    }
    catch (error) {
        console.error(`Error saving new summary files for ID ${newSummaryId}:`, error);
        return trimmedSummary;
    }
    const originalChars = originalDocumentForSave.length;
    const summaryChars = trimmedSummary.length;
    const metadata = includeExpansionReferences
        ? `\n\nSummarized large output to avoid excessive tokens (${originalLines} -> ${summaryLines} lines, ${originalChars} -> ${summaryChars} chars) [Write to file with write_source(${newSummaryId}, file_path) or read with read_source(${newSummaryId}, line_start, line_end)]`
        : `\n\nSummarized large output to avoid excessive tokens (${originalLines} -> ${summaryLines} lines, ${originalChars} -> ${summaryChars} chars)`;
    return trimmedSummary + metadata;
}
export async function read_source(summary_id, line_start, line_end, summariesDir) {
    const finalSummariesDir = summariesDir || './summaries';
    const originalFilePath = path.join(finalSummariesDir, `original-${summary_id}.txt`);
    try {
        let content = await fs.readFile(originalFilePath, 'utf-8');
        if (line_start !== undefined && line_end !== undefined) {
            const lines = content.split('\n');
            const start = Math.max(0, line_start);
            const end = Math.min(lines.length, line_end + 1);
            if (start >= end || start >= lines.length) {
                return `Error: Invalid line range requested (${line_start}-${line_end}) for document with ${lines.length} lines.`;
            }
            content = lines.slice(start, end).join('\n');
        }
        return content;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return `Error: Original document for summary ID '${summary_id}' not found at ${originalFilePath}.`;
        }
        console.error(`Error reading original summary source for ID ${summary_id}:`, error);
        return `Error: Could not retrieve original document for summary ID '${summary_id}'.`;
    }
}
export async function write_source(summary_id, file_path, summariesDir) {
    const finalSummariesDir = summariesDir || './summaries';
    const originalFilePath = path.join(finalSummariesDir, `original-${summary_id}.txt`);
    try {
        const content = await fs.readFile(originalFilePath, 'utf-8');
        if (!file_path) {
            return 'Error: file_path is required.';
        }
        try {
            const directory = path.dirname(file_path);
            await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(file_path, content, 'utf-8');
            console.log(`Summary written to file: ${file_path}`);
            return `Successfully wrote ${content.length} chars to file: ${file_path}\n\nStart of content:\n\n${content.substring(0, 400)}...`;
        }
        catch (writeError) {
            console.error(`Error writing summary to file ${file_path}:`, writeError);
            return `Error: Could not write summary to file ${file_path}.`;
        }
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return `Error: Original document for summary ID '${summary_id}' not found at ${originalFilePath}.`;
        }
        console.error(`Error reading original summary source for ID ${summary_id}:`, error);
        return `Error: Could not retrieve original document for summary ID '${summary_id}'.`;
    }
}
export function getSummaryTools(summariesDir) {
    const readSourceWrapper = async (summary_id, line_start, line_end) => {
        return read_source(summary_id, line_start, line_end, summariesDir);
    };
    const writeSourceWrapper = async (summary_id, file_path) => {
        return write_source(summary_id, file_path, summariesDir);
    };
    return [
        createToolFunction(readSourceWrapper, 'Read the original (not summarized) document content. If possible, limit lines to limit tokens returned. Results will be truncated to 1000 characters - for larger files, use write_source.', {
            summary_id: {
                type: 'string',
                description: 'The unique ID of the summary.',
            },
            line_start: {
                type: 'number',
                description: 'Starting line to retrieve (0-based). Optional.',
                optional: true,
            },
            line_end: {
                type: 'number',
                description: 'Ending line to retrieve (0-based). Optional.',
                optional: true,
            },
        }),
        createToolFunction(writeSourceWrapper, 'Write the original (not summarized) document to a file.', {
            summary_id: {
                type: 'string',
                description: 'The unique ID of the summary.',
            },
            file_path: {
                type: 'string',
                description: 'Relative or absolute path to write the document to.',
            },
        }),
    ];
}
export function hasExpansionTools(toolNames) {
    return toolNames.includes('write_source') && toolNames.includes('read_source');
}
