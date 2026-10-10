import type { CSSProperties } from 'react';
import { titleStrokeHeight, type TitleStroke } from './title-strokes';

/** The page's own pen stroke under its title (title-strokes.ts). Decoration only. Its box takes the stroke's aspect ratio
 *  from the first paint, so drawing it in (docs.css) moves nothing around it. */
export function DocsTitleStroke({ stroke }: { stroke: TitleStroke }) {
  const size = { '--stroke-reach': stroke.reach, '--stroke-width': stroke.width, aspectRatio: `${stroke.width} / ${titleStrokeHeight}` } as CSSProperties;
  return <svg key={stroke.name} className="docs-title-stroke" data-stroke={stroke.name} style={size} viewBox={`0 0 ${stroke.width} ${titleStrokeHeight}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path pathLength={1} d={stroke.d} vectorEffect="non-scaling-stroke" />
  </svg>;
}
