// Small stroke icons used only inside the homepage drawings. All are decorative.
import type { ReactNode } from 'react';

const icons: Record<string, ReactNode> = {
  sparkle: <path d="M12 3c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7z" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></>,
  doc: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></>,
  codex: <><rect x="3" y="4" width="18" height="16" rx="4" /><path d="m8 9.5 3 2.5-3 2.5M13 15h3.5" /></>,
  cart: <><path d="M3 4h3l2.5 11h9L20 7H7" /><circle cx="10" cy="19" r="1" /><circle cx="17" cy="19" r="1" /></>,
};

export type IconName = keyof typeof icons;

export function Icon({ name }: { name: IconName }) {
  return <svg className="d-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[name]}</svg>;
}
