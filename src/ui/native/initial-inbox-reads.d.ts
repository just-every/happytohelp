type InitialReadOutcome = {result: any} | {error: {status?: number; message: string; data?: any}};
export interface InitialInboxReads {
    id: string;
    projectId: string;
    conversationId: string;
    path: string;
    matches(scope: {projectId: string; conversationId: string; path: string}): boolean;
    expire(): void;
    take(resource: 'conversation' | 'buckets' | 'connections', scope: {
        projectId: string; conversationId: string; path: string;
        signal?: AbortSignal; isCurrent(): boolean;
    }): Promise<InitialReadOutcome | undefined>;
}
export function createInitialInboxReads(raw?: {
    projectId: string; conversationId: string;
    conversation?: InitialReadOutcome; buckets?: InitialReadOutcome; connections?: InitialReadOutcome;
} | null): InitialInboxReads | undefined;
