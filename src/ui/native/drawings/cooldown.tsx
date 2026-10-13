/** How long a drawing stays still after it last drew itself in. The one place this is set. */
export const DRAWING_COOLDOWN = 2 * 60 * 1000;

// Each drawing draws in the first time it is shown, then holds still for DRAWING_COOLDOWN, so clicking through pages does
// not replay the same pen strokes. The time it last drew in is kept per drawing, by name, in localStorage (it survives
// navigation and a reload; where storage is blocked every showing draws in). settle decides once per element and says so
// in its data-drawn: `play` leaves the drawing's own animation running, `still` is read by each drawing's stylesheet to show
// it finished from the first paint. A drawing counts as shown when its first stroke starts, so an element replaced before
// that (a list that renders twice as it loads) leaves nothing behind. settle reads only its arguments, so CooldownScript
// can run the same text before hydration.
function settle(node: Element, name: string, cooldown: number) {
  if (node.hasAttribute('data-drawn')) return;
  const key = `h2h-drawn:${name}`;
  let still = false;
  try {
    const age = Date.now() - Number(localStorage.getItem(key));
    still = age >= 0 && age < cooldown;
  } catch { /* storage blocked: draw in */ }
  node.setAttribute('data-drawn', still ? 'still' : 'play');
  if (!still) node.addEventListener('animationstart', () => { try { localStorage.setItem(key, String(Date.now())); } catch { /* storage blocked */ } }, { once: true });
}

/** A ref for the element that holds a drawing's strokes: it settles when the element mounts, before the first paint. */
export const cooldownRef = (name: string) => (node: Element | null) => { if (node) settle(node, name, DRAWING_COOLDOWN); };

/** For a drawing in server-rendered HTML, right after its element: settles it as the page parses, so a drawing still in
 *  its cooldown is never painted drawing in. The element carries suppressHydrationWarning for the attribute it sets. */
export function CooldownScript({ name }: { name: string }) {
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(${settle})(document.currentScript.previousElementSibling,${JSON.stringify(name)},${DRAWING_COOLDOWN})` }} />;
}
