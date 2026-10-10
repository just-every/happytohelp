import { BrandMark } from './BrandMark';
import { BrandWord } from './BrandWord';

/** The header and footer lockup: one link home, the mark and the drawn wordmark, named by visually hidden text. */
export function BrandLockup({ home }: { home: string }) {
  return <a className="brand" href={home}><BrandMark /><BrandWord /><span className="brand-name">HappyToHelp</span></a>;
}
