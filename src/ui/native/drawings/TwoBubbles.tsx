import { Dots, Drawing } from './Drawing';

/** Two chat bubbles waiting, and an aqua arrow pointing back to the list: the inbox with no chat open. */
export function TwoBubbles() {
  return <Drawing name="two-bubbles" blob="right" sparksAt={[184, 16]}>
    <path className="h2h-drawing-fill" pathLength={1} d="M121 28H172C181 28 185 33 185 41V64C185 72 181 76 172 76H168L172 89 157 76H124C116 76 112 72 112 64V40C112 33 115 28 121 28Z" />
    <Dots x={134} y={52} />
    <path className="h2h-drawing-fill" pathLength={1} d="M93 62H136C144 62 148 66 148 74V95C148 103 144 107 136 107H105L90 118 94 107H93C85 107 81 103 81 95V74C81 66 85 62 93 62Z" />
    <Dots x={101} y={85} />
    <path className="h2h-drawing-aqua" pathLength={1} d="M72 99C62 95 55 86 47 82 39 78 32 84 37 90 42 96 51 89 46 80 40 70 28 65 14 66" />
    <path className="h2h-drawing-aqua" pathLength={1} d="M22 58 13 66 23 73" />
  </Drawing>;
}
