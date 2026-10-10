import { useCallback } from 'react';

import { playOnceSeen, REVEAL_LINE } from './observer';

// A moment's state lives in its data-reveal attribute, which motion.css reads:
//   (none)  the final drawing. Server HTML, no script, reduced motion, and any moment already on screen when the page
//           wakes up all stay here, so nothing that has been seen is ever hidden again.
//   wait    below the reveal line: its moving parts hold their first frame (opacity and transforms only, so no layout moves).
//   play    it has been seen: each part runs its one short animation and comes to rest on the final drawing.
const motionWelcome = () => typeof window.IntersectionObserver === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A ref that makes the element one moment of the page: it plays once, the first time it scrolls into view. */
export function useReveal<T extends Element = HTMLElement>() {
  return useCallback((node: T | null) => {
    if (!node || node.hasAttribute('data-reveal') || !motionWelcome()) return;
    if (node.getBoundingClientRect().top < window.innerHeight * REVEAL_LINE) return;
    node.setAttribute('data-reveal', 'wait');
    const stop = playOnceSeen(node, () => node.setAttribute('data-reveal', 'play'));
    // Detached before it was seen (a remount): drop the hold, so the next attach decides afresh.
    return () => { stop(); if (node.getAttribute('data-reveal') === 'wait') node.removeAttribute('data-reveal'); };
  }, []);
}
