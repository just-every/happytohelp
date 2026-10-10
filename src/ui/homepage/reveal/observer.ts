// One IntersectionObserver for every moment on the homepage. A moment is watched until it first crosses the reveal line
// (85% of the way down the viewport), then it plays and is never watched again, so each moment plays once.
type Play = () => void;

/** How far down the viewport a moment must come before it plays, as a fraction of the viewport's height. */
export const REVEAL_LINE = 0.85;

const waiting = new Map<Element, Play>();
let observer: IntersectionObserver | null = null;

function forget(node: Element) {
  waiting.delete(node);
  observer?.unobserve(node);
}

function seen(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const play = waiting.get(entry.target);
    forget(entry.target);
    play?.();
  }
}

/** Calls `play` once, the first time `node` crosses the reveal line. Returns a function that stops watching. */
export function playOnceSeen(node: Element, play: Play) {
  observer ??= new IntersectionObserver(seen, { rootMargin: `0px 0px -${Math.round((1 - REVEAL_LINE) * 100)}% 0px` });
  waiting.set(node, play);
  observer.observe(node);
  return () => forget(node);
}
