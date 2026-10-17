import type { ComponentType, ReactNode } from 'react';
import { BrandMark } from './BrandMark';
import { BrandWord } from './BrandWord';

type LockupLink = ComponentType<{ className: string; to: string; children: ReactNode; 'data-rer-name'?: string }>;

/** The header and footer lockup: one link home, the mark and the drawn wordmark, named by visually hidden text. Inside the
 *  workspace the router's own link (`as`) carries it, so following it keeps the signed-in app loaded. `named` marks the
 *  product label for rer's Demo/Dev suffix (Base modules/demo); only the signed-in navigation uses it. */
export function BrandLockup({ home, as: Anchor, named }: { home: string; as?: LockupLink; named?: boolean }) {
  const content = <><BrandMark /><BrandWord /><span className="brand-name">HappyToHelp</span></>;
  const label = named ? { 'data-rer-name': '' } : {};
  return Anchor ? <Anchor className="brand" to={home} {...label}>{content}</Anchor> : <a className="brand" href={home} {...label}>{content}</a>;
}
