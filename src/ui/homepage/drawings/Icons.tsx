// Small stroke icons used in the homepage drawings and beside the Free section's three promises. All are decorative.
import type { ReactNode } from 'react';

const icons: Record<string, ReactNode> = {
  sparkle: <path d="M12 3c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7z" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></>,
  doc: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  code: <path d="m8.5 7.5-4.5 4.5 4.5 4.5M15.5 7.5l4.5 4.5-4.5 4.5M13.6 5.5l-3.2 13" />,
  person: <><circle cx="12" cy="8" r="4" fill="currentColor" /><path d="M4.5 20.5c0-4.3 3.4-6.8 7.5-6.8s7.5 2.5 7.5 6.8z" fill="currentColor" /></>,
  cart: <><path d="M3 4h3l2.5 11h9L20 7H7" /><circle cx="10" cy="19" r="1" /><circle cx="17" cy="19" r="1" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c0-3.4 2.4-5.6 5.5-5.6s5.5 2.2 5.5 5.6" /><circle cx="16.6" cy="9.4" r="2.5" /><path d="M16.2 13.9c2.6 0 4.4 1.9 4.4 5" /></>,
  plans: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.6 8.5h6.8M8.6 12h6.8M8.6 15.5h4" /></>,
  fees: <><path d="M3.8 11.9V5.3c0-.8.7-1.5 1.5-1.5h6.6l8.3 8.3-8.1 8.1z" /><circle cx="8.3" cy="8.3" r="1.3" /><path d="M3 21 21 3" /></>,
};

export type IconName = keyof typeof icons;

export function Icon({ name }: { name: IconName }) {
  return <svg className="d-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[name]}</svg>;
}
