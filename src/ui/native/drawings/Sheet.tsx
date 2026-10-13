/** A sheet of paper with ruled lines, slightly turned, as the landing draws its help articles. */
export function Sheet({ lines = 4 }: { lines?: number }) {
  return <g>
    <path className="h2h-drawing-fill" pathLength={1} d="M78 22 140 16C143 16 145 18 145 21L152 108C152 111 150 113 147 113L86 119C83 119 81 117 81 114L74 27C74 24 75 22 78 22Z" />
    {Array.from({ length: lines }, (_, i) => <path key={i} pathLength={1} d={`M${88 + i} ${40 + i * 15}L${i === 2 ? 122 : 134} ${35 + i * 15}`} />)}
  </g>;
}
