import { useReveal } from './reveal/useReveal';

// A full-width aqua pen line with one loop, drawn in once, between two sections. Decoration only. Each line keeps its own
// aspect ratio, so the loop stays round: the long one spans wide layouts, the short one phones.
export function Divider() {
  const reveal = useReveal<HTMLDivElement>();
  return <div className="divider" aria-hidden="true" ref={reveal}>
    <svg className="divider-line divider-line--wide" viewBox="0 0 1400 110" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path pathLength={1} d="M6 78C170 34 340 30 500 52 580 63 650 74 690 60 728 47 736 18 712 12 688 6 670 30 684 54 704 88 790 98 900 90 1060 78 1240 52 1394 62" />
    </svg>
    <svg className="divider-line divider-line--short" viewBox="0 0 400 110" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path pathLength={1} d="M4 76C50 48 110 44 156 58 180 65 202 68 212 54 222 38 214 20 198 20 182 20 176 42 188 60 206 88 262 90 312 80 342 74 372 64 396 60" />
    </svg>
  </div>;
}
