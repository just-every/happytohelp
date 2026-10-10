// The pale aqua blob behind each drawing below the hero, as the hero's drawing floats on its own. Decoration only. It fills
// its figure's box (stretched, so one shape fits any card), and each figure's padding decides which side it swells to.
const SHAPES = {
  // swells up and to the left
  left: 'M7 34C12 14 30 3 52 2 72 1 90 8 96 26 101 42 99 62 95 78 90 94 72 99 50 98 30 97 9 93 3 74 0 60 3 46 7 34Z',
  // swells down and to the right
  right: 'M4 46C3 26 14 8 34 4 52 0 74 3 87 13 98 22 101 42 98 60 95 80 84 96 62 99 42 101 18 97 9 82 5 72 5 58 4 46Z',
  // a rounder pebble
  pebble: 'M12 17C24 4 46 0 64 3 82 6 96 19 98 39 100 57 97 76 85 88 71 99 47 100 29 95 13 89 2 73 2 55 2 39 4 27 12 17Z',
  // long and low, for a wide card
  long: 'M5 40C8 20 24 7 44 4 62 2 84 5 94 20 101 33 99 54 96 69 92 86 76 98 56 98 36 98 14 95 6 79 2 66 3 52 5 40Z',
};

export type BlobShape = keyof typeof SHAPES;

export function Blob({ shape }: { shape: BlobShape }) {
  return <svg className={`d-blob d-blob--${shape}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d={SHAPES[shape]} /></svg>;
}
