import { wordGlyphs, wordHeightEm, wordStrokeWidth, wordViewBox, wordWidthEm } from './brand-word';

/** The drawn HappyToHelp wordmark beside the mark, in the link's ink. Decorative: the link's hidden text names it. */
export function BrandWord() {
  return <svg className="brand-word" viewBox={wordViewBox} width={`${wordWidthEm}em`} height={`${wordHeightEm}em`} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={wordStrokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {wordGlyphs.map(({ x, d }) => <path key={x} transform={`translate(${x} 0)`} d={d} />)}
  </svg>;
}
