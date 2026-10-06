import type { ParsedLocation } from '@tanstack/react-router';
import { nativeRequest } from './transport';

const delegationPage = /^\/delegation\/(authorize|settings)\/?$/;

/** Connected applications and the consent screen name their workspace in `account_id`. */
export function delegationAccount(location: ParsedLocation): string | undefined {
    if (!delegationPage.test(location.pathname)) return undefined;
    const account = (location.search as Record<string, unknown>).account_id;
    return typeof account === 'string' && account ? account : undefined;
}

export type ConsentProblem = { code?: string; message: string };

/**
 * An application's connection request is checked before the page renders, so the screen and its
 * decision form appear together. A rejected request is a result for the page to explain; only an
 * expired session (401) is left to the dashboard's sign-in redirect.
 */
export async function loadConsent(location: ParsedLocation, signal: AbortSignal) {
    if (delegationPage.exec(location.pathname)?.[1] !== 'authorize' || !location.searchStr) return undefined;
    try {
        return { request: (await nativeRequest('/delegation/authorize/request' + location.searchStr, { signal })).data };
    } catch (error: any) {
        if (error.status === 401 || signal.aborted) throw error;
        return { problem: { code: error.data?.error?.code, message: error.message } as ConsentProblem };
    }
}
