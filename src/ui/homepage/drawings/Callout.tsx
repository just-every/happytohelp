// A hand-drawn circled numeral with a short loose arrow. It sits to the left of what it points at; the words
// for each number are the caption row under the drawing, so this is decoration only.
export function Callout({ n }: { n: 1 | 2 | 3 }) {
  return <span className="callout" aria-hidden="true">
    <span className="callout-ring">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" focusable="false"><path d="M17 3.6c7.4-.2 12.2 5.2 11.6 12.2-.6 7.2-6.4 12.4-13.4 12.1C8 27.6 3.2 22 3.7 15.4 4.2 9 9.3 4.4 16 4" /></svg>
      <b>{n}</b>
    </span>
    <svg className="callout-arrow" viewBox="0 0 28 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M1.5 8.5c7-2.6 14-3 22.5-1.2M18.5 2.2 24.4 7.2 18.8 12" /></svg>
  </span>;
}
