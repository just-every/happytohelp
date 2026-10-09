// Geometry of the corner marks: emphasis lines that radiate out of a frame's top-right corner.
//
// Each mark is authored around a virtual centre C = (0, 0) that stands for the frame's corner point, y up, in
// "mark units". Every stroke leaves a ring about 5.6 units from C along its own ray (angle in degrees, 0 = right,
// 90 = up), so the strokes read as one burst springing from the corner. The sparkle's four-point star aims one tip at C.
//
// The mark's ORIGIN is the mean of its strokes' inner ends (the ring ends; the star's tip that faces C). CSS seats that
// origin a fixed distance up and right of the frame's corner (--mark-ox, --mark-below and --mark-r say where the origin
// is inside the svg box), so every mark keeps the same offset from its corner at every width; when a narrow gutter calls
// for it, the mark shrinks about its origin, which leaves that offset alone and only draws the strokes shorter.

export type MarksVariant = 'spark' | 'sparkle' | 'tick';

type Point = [number, number];
type Ray = { angle: number; from: number; length: number };

export const MARK_STROKE = 1.8; // stroke width, in mark units
const RING = 5.6;
const HALF = MARK_STROKE / 2;

const RAYS: Record<Exclude<MarksVariant, 'sparkle'>, Ray[]> = {
  // two slashes and a dash
  spark: [{ angle: 68, from: RING + 0.3, length: 9 }, { angle: 44, from: RING - 0.2, length: 11 }, { angle: 19, from: RING, length: 10 }],
  // a short upright tick, a leaning one and a long dash
  tick: [{ angle: 66, from: RING + 0.2, length: 6.5 }, { angle: 43, from: RING, length: 9.5 }, { angle: 20, from: RING - 0.2, length: 13 }],
};
const SPARKLE = { dash: { angle: 14, from: RING, length: 10.5 } as Ray, starAngle: 62, starRadius: 4.7 };

const at = (angle: number, radius: number): Point => [radius * Math.cos((angle * Math.PI) / 180), radius * Math.sin((angle * Math.PI) / 180)];
const num = (n: number) => String(Math.round(n * 100) / 100);
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

// y flips from authoring (up) to svg (down) at the very end.
function ray({ angle, from, length }: Ray) {
  const inner = at(angle, from), outer = at(angle, from + length);
  return { inner, extremes: [inner, outer], d: `M${num(inner[0])} ${num(-inner[1])}L${num(outer[0])} ${num(-outer[1])}` };
}

// A four-point star with concave sides, one tip aimed at C. Tip i lies along e1 and the next tip, a quarter turn on, along
// e2; each side is a cubic whose controls sit near the centre (the same side curve the old sparkle used, scaled to the radius).
function star(centreAngle: number, radius: number) {
  const centre = at(centreAngle, RING + radius);
  const face = centreAngle + 180; // the first tip faces C
  const k = radius / 6;
  const tip = (i: number): Point => { const v = at(face + 90 * i, radius); return [centre[0] + v[0], centre[1] + v[1]]; };
  const pull = (i: number, along: number, across: number): Point => {
    const e1 = at(face + 90 * i, 1), e2 = at(face + 90 * (i + 1), 1);
    return [centre[0] + k * (along * e1[0] + across * e2[0]), centre[1] + k * (along * e1[1] + across * e2[1])];
  };
  const f = ([x, y]: Point) => `${num(x)} ${num(-y)}`;
  const tips = [0, 1, 2, 3].map(tip);
  const d = `M${f(tips[0])}` + [0, 1, 2, 3].map(i => `C${f(pull(i, 2, 0.6))} ${f(pull(i, 0.6, 2))} ${f(tips[(i + 1) % 4])}`).join('') + 'z';
  return { inner: tips[0], extremes: tips, d };
}

function build(variant: MarksVariant) {
  const strokes = variant === 'sparkle'
    ? [star(SPARKLE.starAngle, SPARKLE.starRadius), ray(SPARKLE.dash)]
    : RAYS[variant].map(ray);
  const origin: Point = [mean(strokes.map(s => s.inner[0])), mean(strokes.map(s => s.inner[1]))];
  const points = strokes.flatMap(s => s.extremes);
  const left = Math.min(...points.map(p => p[0])) - HALF, right = Math.max(...points.map(p => p[0])) + HALF;
  const top = Math.min(...points.map(p => -p[1])) - HALF, bottom = Math.max(...points.map(p => -p[1])) + HALF;
  return {
    paths: strokes.map(s => s.d),
    viewBox: `${num(left)} ${num(top)} ${num(right - left)} ${num(bottom - top)}`,
    // Where the origin sits in the svg box, in mark units: from the left edge, from the bottom edge, and the box's reach to the right of it.
    vars: { '--mark-w': num(right - left), '--mark-ox': num(origin[0] - left), '--mark-below': num(bottom + origin[1]), '--mark-reach': num(right - origin[0]) },
  };
}

export const MARKS: Record<MarksVariant, ReturnType<typeof build>> = { spark: build('spark'), sparkle: build('sparkle'), tick: build('tick') };
