// Shared drawing primitives: the ink-framed "sketch" window and the loose marks around it.
import type { CSSProperties, ReactNode } from 'react';

import { MARKS, MARK_STROKE, type MarksVariant } from './marks';

export type { MarksVariant };

// Short hand-drawn emphasis strokes that radiate out of the frame's top-right corner. Pure decoration; the draw-in animation
// is disabled for reduced motion. The strokes are drawn around a common origin (see marks.ts) and CSS seats that origin a
// fixed distance up and right of the corner, the same for every mark, so the svg only carries where its origin is.
export function SketchMarks({ variant = 'spark' }: { variant?: MarksVariant }) {
  const mark = MARKS[variant];
  return <svg className={`d-marks d-marks--${variant}`} style={mark.vars as CSSProperties} viewBox={mark.viewBox} fill="none" stroke="currentColor" strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {mark.paths.map(d => <path key={d} d={d} pathLength={1} />)}
  </svg>;
}

// A window with an ink border and three dots. Children are the drawn page.
export function SketchWindow({ className = '', bar = true, children }: { className?: string; bar?: boolean; children: ReactNode }) {
  return <div className={`d-window ${className}`.trim()}>
    {bar && <div className="d-bar"><i /><i /><i /></div>}
    {children}
  </div>;
}

// A figure that exposes one accessible label for the whole drawing and hides its inner text from assistive tech.
export function Drawing({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return <figure className={`drawing ${className}`.trim()} role="img" aria-label={label}>{children}</figure>;
}
