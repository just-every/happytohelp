import { Blob } from '../homepage/drawings/Blob';
import { InkArrow } from '../homepage/drawings/InkArrow';
import { Sparks } from '../homepage/drawings/Sparks';
import { penLoop } from '../native/drawings/Drawing';
import { CooldownScript, cooldownRef } from '../native/drawings/cooldown';

/** Beside sign-in and sign-up: three hand-outlined bubbles in the landing hero's hand, a question answered and thanked,
 *  on a pale aqua blob with the mark's sparks and the looping pen line under it, which draws in the first time and then holds
 *  still for a while (cooldown.tsx). Decoration only. */
export default function SignInDrawing() {
    return <figure className="id-drawing" aria-hidden="true">
        <Blob shape="pebble" />
        <div className="id-thread">
            <div className="id-line"><b className="id-who">Maya</b><p className="id-bubble">Is my order on its way?<Sparks /></p></div>
            <div className="id-line id-line--fix"><InkArrow variant="long" /><p className="id-bubble id-bubble--team">It ships today. Here is your tracking link.</p></div>
            <div className="id-line id-line--reply"><InkArrow variant="short" /><p className="id-bubble id-bubble--composer"><span>Thanks, that’s perfect!</span><span className="id-send">Send</span></p></div>
        </div>
        <svg ref={cooldownRef('sign-in')} suppressHydrationWarning className="id-pen" viewBox="0 0 240 60" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path data-intro="" pathLength={1} d={penLoop} /></svg>
        <CooldownScript name="sign-in" />
    </figure>;
}
