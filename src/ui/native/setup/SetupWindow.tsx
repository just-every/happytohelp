import type { CSSProperties } from 'react';
import { bubble, face, inkWidth } from '../../homepage/brand-mark';
import { SketchWindow } from '../../homepage/drawings/Sketch';
import { Sparks } from '../../homepage/drawings/Sparks';
import { shownColour } from './draft';

// The aqua pen line the window rests on: in from the left under the window, out of its right side, one loop and away, as in
// 12ui's drawing for the workspace step. Drawn in the art's 650x250 box.
const line = 'M2 170C32 145 72 127 112 130C142 133 162 145 187 150C270 150 420 150 490 160C532 166 557 160 574 140C592 113 587 97 570 100C550 104 552 133 570 155C592 183 622 200 648 205';

/** The page's ink token or white, whichever stands out more on the brand colour. */
function faceColour(hex: string) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.195 ? 'var(--ink)' : '#fff';
}

/**
 * The workspace as its visitors will meet it: a browser window titled with the workspace name and the chat bubble in the
 * brand colour, both live from the draft. Decoration only; the fields beside it say the same in words.
 */
export default function SetupWindow({ name, colour }: { name: string; colour: string }) {
    const brand = shownColour(colour);
    return <div className="setup-window-art">
        <svg className="setup-window-line" viewBox="0 0 650 250" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true" focusable="false"><path d={line} /></svg>
        <div className="setup-window-tilt">
            <span className="setup-window-ink"><Sparks /></span>
            <SketchWindow className="setup-window">
                <b className="setup-window-title">{name}</b>
                <div className="setup-window-page">
                    <i /><i /><i /><i />
                    <span className="setup-window-chat" style={{ '--brand': brand, color: faceColour(brand) } as CSSProperties}>
                        <svg viewBox="0 12 86 86" fill="none" stroke="currentColor" strokeWidth={inkWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={bubble} />{face.map(d => <path key={d} d={d} />)}</svg>
                        <span className="setup-window-sparks"><Sparks /></span>
                    </span>
                </div>
            </SketchWindow>
        </div>
    </div>;
}
