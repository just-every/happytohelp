import { Drawing, penLoop } from './Drawing';
import { Sheet } from './Sheet';

/** A sheet with a pen: Knowledge, and saved replies with none yet. */
export function Notepad() {
  return <Drawing name="notepad" blob="right" sparksAt={[166, 6]}>
    <path className="h2h-drawing-aqua h2h-drawing-aqua--scaled" pathLength={1} transform="translate(-6 82) scale(0.36)" d={penLoop} />
    <Sheet />
    <path className="h2h-drawing-fill" pathLength={1} d="M173 30 183 39 145 93 132 101 135 86Z" />
    <path pathLength={1} d="M164 43 174 52M135 86 145 93" />
  </Drawing>;
}
