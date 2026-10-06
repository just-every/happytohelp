import type { ReactNode } from 'react';
import type { LinkProblemState } from './hooks';

const copy: Record<LinkProblemState, (noun: string) => [string, string]> = {
    missing: noun => [`This ${noun} link is incomplete`, `The link is missing its code. Open the full link from your email again, or ask for a new one.`],
    invalid: noun => [`This ${noun} link is invalid or has expired`, `It may have been cancelled or replaced, or copied incorrectly. Ask for a new one.`],
    expired: noun => [`This ${noun} link has expired`, `These links only work for a limited time. Ask for a new one.`],
    used: noun => [`This ${noun} link has already been used`, `If that was you, you can sign in now.`],
};

/** The page body for a link that cannot be used, with the ways out passed in as children. */
export default function LinkProblem({ state, noun, children }: { state: LinkProblemState; noun: string; children: ReactNode }) {
    const [title, detail] = copy[state](noun);
    return <><h1>{title}</h1><p className="id-lede">{detail}</p><div className="id-links">{children}</div></>;
}
