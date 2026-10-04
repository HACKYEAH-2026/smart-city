/**
 * The dashboard grid (design "Układ pulpitu"): widgets of `w` columns × `h` rows placed in order like a CSS grid with
 * `grid-auto-flow: row dense`, so a narrow widget fills a gap left earlier. The resident dashboard, the layout editor
 * and its preview in "Zarządzaj miejscem" all place widgets with this one rule.
 */
export type GridSize = { w: number; h: number };
/** An item's top-left cell (0-based) and its span (`w` clamped to the grid's columns). */
export type GridCell = { col: number; row: number; w: number; h: number };
export type GridRect = { left: number; top: number; width: number; height: number };
export type GridMetrics = { width: number; columns: number; rowHeight: number; gap: number };

/** Places the items in order; returns each item's cell and the number of rows used. */
export function packGrid(sizes: GridSize[], columns: number): { cells: GridCell[]; rows: number } {
  const taken = new Set<string>();
  const cells = sizes.map((size) => {
    const cell = firstFree(taken, { w: Math.min(size.w, columns), h: size.h }, columns);
    cellsOf(cell).forEach((key) => {
      taken.add(key);
    });
    return cell;
  });
  const rows = cells.reduce((max, cell) => Math.max(max, cell.row + cell.h), 0);
  return { cells, rows };
}

/** Keys of the grid cells an item covers. */
const cellsOf = ({ col, row, w, h }: GridCell) =>
  Array.from({ length: w * h }, (_, i) => `${col + (i % w)}:${row + Math.floor(i / w)}`);

/** "dense": every item searches from the grid's start, row by row, for the first place it fits. */
function firstFree(taken: Set<string>, span: GridSize, columns: number): GridCell {
  const across = columns - span.w + 1;
  // Each placed item covers at least one cell, so a free place exists within one row more than the cells taken.
  const places = Array.from({ length: (taken.size + 1) * across }, (_, i) => ({
    col: i % across,
    row: Math.floor(i / across),
    ...span,
  }));
  const place = places.find((cell) => cellsOf(cell).every((key) => !taken.has(key)));
  if (!place) throw new Error("packGrid: no free place found");
  return place;
}

/** Height of `rows` grid rows with the gaps between them. */
export const gridHeight = (rows: number, rowHeight: number, gap: number) =>
  rows > 0 ? rows * rowHeight + (rows - 1) * gap : 0;

/**
 * Each item with its pixel rectangle (relative to the grid's top left) in a grid `width` wide, in the items' order,
 * and the grid's total height (which does not depend on the width).
 */
export function gridRects<T extends { size: GridSize }>(
  items: T[],
  metrics: GridMetrics,
): { tiles: { item: T; rect: GridRect }[]; height: number } {
  const { width, columns, rowHeight, gap } = metrics;
  const { cells, rows } = packGrid(
    items.map((item) => item.size),
    columns,
  );
  const column = (width - gap * (columns - 1)) / columns;
  const rectOf = (cell: GridCell): GridRect => ({
    left: cell.col * (column + gap),
    top: cell.row * (rowHeight + gap),
    width: cell.w * column + (cell.w - 1) * gap,
    height: gridHeight(cell.h, rowHeight, gap),
  });
  const tiles = items.flatMap((item, i) => {
    const cell = cells[i];
    return cell ? [{ item, rect: rectOf(cell) }] : [];
  });
  return { tiles, height: gridHeight(rows, rowHeight, gap) };
}
