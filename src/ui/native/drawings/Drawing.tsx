import type { ReactNode } from 'react';
import { Blob, type BlobShape } from '../../homepage/drawings/Blob';
import { sparks } from '../../homepage/brand-mark';
import { cooldownRef } from './cooldown';
import './drawings.css';

/** The landing's pen line with one loop, cut to a 240 by 60 box. */
export const penLoop = 'M4 46C30 30 62 26 92 34 104 38 118 40 124 31 130 21 123 11 112 12 101 13 97 27 106 38 119 54 158 55 192 48 212 44 226 38 236 35';

/**
 * A small drawing in the landing's hand for a page header, an empty state or a notice: ink outlines on a pale aqua blob
 * (Blob.tsx), the mark's sparks and, where it helps, the looping pen line. Decoration only. Every stroke has length 1, so
 * drawings.css draws it in like the landing the first time its name is shown, then not again for DRAWING_COOLDOWN
 * (cooldown.tsx); reduced motion shows it drawn. The art is drawn in a 220 by 140 box.
 */
export function Drawing({ name, blob = 'pebble', sparksAt, children }: { name: string; blob?: BlobShape; sparksAt?: [number, number]; children: ReactNode }) {
  return <figure ref={cooldownRef(name)} className={`h2h-drawing h2h-drawing--${name}`} aria-hidden="true">
    <Blob shape={blob} />
    <svg className="h2h-drawing-art" viewBox="0 0 220 140" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {children}
      {sparksAt && <g className="h2h-drawing-sparks" transform={`translate(${sparksAt[0]} ${sparksAt[1]}) scale(0.62) translate(-78 -2)`}>
        {sparks.map(d => <path key={d} d={d} pathLength={1} />)}
      </g>}
    </svg>
  </figure>;
}

/** Three ink dots, as typed in a chat bubble. */
export function Dots({ x, y, gap = 13 }: { x: number; y: number; gap?: number }) {
  return <g className="h2h-drawing-dots">{[0, 1, 2].map(i => <circle key={i} cx={x + i * gap} cy={y} r="2.6" />)}</g>;
}

/** The pen line on its own, as a short aqua underline (the greeting above the setup card). `progress` is the loading
 *  screen's, which its busy frame loops (identity.css) and which never counts as having been drawn. */
export function PenLine({ progress = false }: { progress?: boolean }) {
  return <svg ref={progress ? undefined : cooldownRef('pen-line')} className="h2h-pen-line" viewBox="0 0 240 60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path pathLength={1} d={penLoop} /></svg>;
}
