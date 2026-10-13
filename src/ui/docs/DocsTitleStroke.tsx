import type { CSSProperties } from 'react';
import { CooldownScript, cooldownRef } from '../native/drawings/cooldown';
import { titleStrokeHeight, type TitleStroke } from './title-strokes';

/** The page's own pen stroke under its title (title-strokes.ts). Decoration only. Its box takes the stroke's aspect ratio
 *  from the first paint, so drawing it in (docs.css) moves nothing around it. Every page's stroke counts as the one drawing:
 *  it draws in the first time, then holds still for a while (cooldown.tsx), so moving between pages does not replay it. */
export function DocsTitleStroke({ stroke }: { stroke: TitleStroke }) {
  const size = { '--stroke-reach': stroke.reach, '--stroke-width': stroke.width, aspectRatio: `${stroke.width} / ${titleStrokeHeight}` } as CSSProperties;
  return <>
    <svg key={stroke.name} ref={cooldownRef('docs-title-stroke')} suppressHydrationWarning className="docs-title-stroke" data-stroke={stroke.name} style={size} viewBox={`0 0 ${stroke.width} ${titleStrokeHeight}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path pathLength={1} d={stroke.d} vectorEffect="non-scaling-stroke" />
    </svg>
    <CooldownScript name="docs-title-stroke" />
  </>;
}
