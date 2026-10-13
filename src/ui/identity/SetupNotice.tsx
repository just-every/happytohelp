import IdentityFrame from './IdentityFrame';
import { Alert } from './fields';

/** /setup when it has nothing to ask: already claimed or unreachable. */
export default function SetupNotice({ state, error }: { state: 'complete' | 'unavailable'; error?: string }) {
    if (state === 'complete') return <IdentityFrame>
        <h1>You’re already set up</h1>
        <p className="id-lede">This installation already has an owner. Sign in to continue to your workspace.</p>
        <div className="id-actions"><a className="pill pill--ink" href="/login?returnTo=%2Fsetup">Sign in</a></div>
    </IdentityFrame>;
    return <IdentityFrame>
        <h1>Set up HappyToHelp</h1>
        <Alert>{error || 'Setup status could not be read.'}</Alert>
        <div className="id-actions"><button className="pill pill--ink" onClick={() => location.reload()}>Retry</button></div>
    </IdentityFrame>;
}
