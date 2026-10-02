// Shared drawing primitives: the ink-framed "sketch" window and the loose marks around it.
import type { ReactNode } from 'react';

export type MarksVariant = 'spark' | 'sparkle' | 'tick';

// Short hand-drawn strokes. Pure decoration; the draw-in animation is disabled for reduced motion.
export function SketchMarks({ variant = 'spark' }: { variant?: MarksVariant }) {
  const paths: Record<MarksVariant, string[]> = {
    spark: ['M2 12 8 4', 'M12 10l6-5', 'M14 20h8'],
    sparkle: ['M10 2c.6 4 2 5.4 6 6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.6 5.4-2 6-6z', 'M20 16l5-1'],
    tick: ['M5 15 3 5', 'M13 15l8-7', 'M19 24h8'],
  };
  return <svg className={`d-marks d-marks--${variant}`} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {paths[variant].map(d => <path key={d} d={d} pathLength={1} />)}
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
