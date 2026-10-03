/**
 * SVG path that covers a `width` × `height` area with a hole: a square window of `size`, centred, with corners
 * rounded by `radius`. Filled with the even-odd rule, the window stays clear over the dimmed rest.
 */
export function scanWindowPath(width: number, height: number, size: number, radius: number): string {
  const x = (width - size) / 2;
  const y = (height - size) / 2;
  const outside = `M0 0 H${width} V${height} H0 Z`;
  const hole = [
    `M${x + radius} ${y}`,
    `H${x + size - radius}`,
    `A${radius} ${radius} 0 0 1 ${x + size} ${y + radius}`,
    `V${y + size - radius}`,
    `A${radius} ${radius} 0 0 1 ${x + size - radius} ${y + size}`,
    `H${x + radius}`,
    `A${radius} ${radius} 0 0 1 ${x} ${y + size - radius}`,
    `V${y + radius}`,
    `A${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
    "Z",
  ].join(" ");
  return `${outside} ${hole}`;
}
