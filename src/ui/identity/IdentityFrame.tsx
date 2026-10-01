import type { ReactNode } from 'react';
import '../homepage/outfit.css';
import './identity.css';

/** The public frame for sign-in, sign-up, recovery and invitation pages: wordmark home, one panel, a way back. */
export default function IdentityFrame({ children }: { children: ReactNode }) {
    return <div className="h2h-identity">
        <header className="id-header"><a className="brand" href="/">HappyToHelp</a></header>
        <main className="id-main"><div className="id-panel">{children}</div></main>
        <footer className="id-footer"><a href="/">Back to home</a></footer>
    </div>;
}
