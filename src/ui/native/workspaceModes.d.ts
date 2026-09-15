export const MODES: string[];
export function normalizeWorkspaceMode(mode?: unknown): 'balanced' | 'light' | 'dark';
export function createWorkspaceTheme(color?: string | null, mode?: string): Record<string, string>;
export function createGlobalInboxSurfaceTheme(background?: string, accent?: string): Record<string, string>;
