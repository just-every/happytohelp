import type { ComponentType, ReactNode } from 'react';
import { BrandMark } from './BrandMark';
import { BrandWord } from './BrandWord';

type LockupLink = ComponentType<{ className: string; to: string; children: ReactNode }>;

/** The header and footer lockup: one link home, the mark and the drawn wordmark, named by visually hidden text. Inside the
 *  workspace the router's own link (`as`) carries it, so following it keeps the signed-in app loaded. */
export function BrandLockup({ home, as: Anchor }: { home: string; as?: LockupLink }) {
  const content = <><BrandMark /><BrandWord /><span className="brand-name">HappyToHelp</span></>;
  return Anchor ? <Anchor className="brand" to={home}>{content}</Anchor> : <a className="brand" href={home}>{content}</a>;
}
