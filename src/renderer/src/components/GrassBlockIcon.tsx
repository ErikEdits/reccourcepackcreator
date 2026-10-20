// 8×8 pixel-art grass block used as the app mark until a real icon exists.
const pixels = [
  'GGGGGGGG',
  'GgGGgGGG',
  'GGgGGGgG',
  'DgDDGDgD',
  'DDdDDDDD',
  'DDDDdDDd',
  'dDDDDDDD',
  'DDdDDdDD',
]

const colours: Record<string, string> = {
  G: '#5d9b34',
  g: '#79b94a',
  D: '#8a5d3b',
  d: '#6e4a2f',
}

export function GrassBlockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {pixels.flatMap((row, y) =>
        [...row].map((key, x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colours[key]} />
        )),
      )}
    </svg>
  )
}
