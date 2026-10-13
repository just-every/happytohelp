import { HydrationUnit } from '../../vendor/base/hydration/unit';
import type { ReactNode } from 'react';
import { BrandLockup } from '../homepage/BrandLockup';
import '../homepage/outfit.css';
import '../homepage/brand-tokens.css';
import './identity.css';

/** The public frame for sign-in, sign-up, recovery and invitation pages: the HappyToHelp lockup home, one panel, a way back.
 *  Sign-in and sign-up add a drawing beside the panel (below it on a phone). */
export default function IdentityFrame({ children, wide = false, drawing }: { children: ReactNode; wide?: boolean; drawing?: ReactNode }) {
    return <div className="h2h-identity">
        <HydrationUnit><header className="id-header"><BrandLockup home="/" /></header></HydrationUnit>
        <HydrationUnit><main className={drawing ? 'id-main id-main--drawn' : 'id-main'}><div className={wide ? 'id-panel id-panel--wide' : 'id-panel'}>{children}</div>{drawing}</main></HydrationUnit>
        <HydrationUnit><footer className="id-footer"><a href="/">Back to home</a></footer></HydrationUnit>
    </div>;
}
