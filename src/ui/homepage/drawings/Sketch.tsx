// Shared drawing primitives: the labelled figure, and the one framed window the drawings keep where a frame helps.
import type { ReactNode } from 'react';

import { useReveal } from '../reveal/useReveal';

// A window with an ink border and a bar of three ink dots: a code editor, a checkout page or an import page. Children are
// the drawn page.
export function SketchWindow({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`d-window ${className}`.trim()}>
    <div className="d-bar"><i /><i /><i /></div>
    {children}
  </div>;
}

// A figure that exposes one accessible label for the whole drawing and hides its inner text from assistive tech. With
// `reveal`, the drawing is one moment of the page and plays once as it scrolls into view (see reveal/useReveal.ts).
export function Drawing({ label, className = '', reveal = false, children }: { label: string; className?: string; reveal?: boolean; children: ReactNode }) {
  const ref = useReveal<HTMLElement>();
  return <figure ref={reveal ? ref : undefined} className={`drawing ${className}`.trim()} role="img" aria-label={label}>{children}</figure>;
}
