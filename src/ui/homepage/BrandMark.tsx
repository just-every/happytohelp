import { bubble, face, inkWidth, markViewBox, sparkColour, sparkWidth, sparks } from './brand-mark';

/** The HappyToHelp mark beside the drawn wordmark. Decorative: the link's hidden text names it. */
export function BrandMark() {
  return <svg className="brand-mark" viewBox={markViewBox} aria-hidden="true" focusable="false" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <g stroke="currentColor" strokeWidth={inkWidth}><path d={bubble} />{face.map(d => <path key={d} d={d} />)}</g>
    <g stroke={sparkColour} strokeWidth={sparkWidth}>{sparks.map(d => <path key={d} d={d} />)}</g>
  </svg>;
}
