import { Drawing, penLoop } from './Drawing';

/** A speech bubble with a question mark, an ink arrow and the pen line: a page or project that is not there. */
export function QuestionBubble() {
  return <Drawing name="question-bubble" blob="pebble" sparksAt={[52, 20]}>
    <path className="h2h-drawing-fill" pathLength={1} d="M76 32H148C156 32 160 36 160 44V84C160 92 156 96 148 96H100L84 110 87 96H76C68 96 64 92 64 84V44C64 36 68 32 76 32Z" />
    <path pathLength={1} d="M101 53C101 45 106 42 112 42 119 42 124 46 124 52 124 59 118 61 114 64 112 66 112 68 112 72" />
    <circle className="h2h-drawing-dot" cx="112" cy="82" r="2.6" />
    <path pathLength={1} d="M30 118C32 104 40 94 54 88M46 86 55 88 52 96" />
    <path className="h2h-drawing-aqua h2h-drawing-aqua--scaled" pathLength={1} transform="translate(150 66) scale(0.34)" d={penLoop} />
  </Drawing>;
}
