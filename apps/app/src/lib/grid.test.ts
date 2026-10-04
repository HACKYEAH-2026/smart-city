import { describe, expect, test } from "bun:test";
import { gridHeight, gridRects, packGrid } from "./grid";

const at = (col: number, row: number, w: number, h: number) => ({ col, row, w, h });

describe("packGrid", () => {
  test("an empty grid has no rows", () => {
    expect(packGrid([], 3)).toEqual({ cells: [], rows: 0 });
  });

  test("full-width widgets stack in order", () => {
    expect(
      packGrid(
        [
          { w: 3, h: 2 },
          { w: 3, h: 3 },
        ],
        3,
      ),
    ).toEqual({ cells: [at(0, 0, 3, 2), at(0, 2, 3, 3)], rows: 5 });
  });

  test("narrow widgets share a row, left to right", () => {
    const { cells, rows } = packGrid(
      [
        { w: 2, h: 1 },
        { w: 1, h: 1 },
        { w: 1, h: 1 },
      ],
      3,
    );
    expect(cells).toEqual([at(0, 0, 2, 1), at(2, 0, 1, 1), at(0, 1, 1, 1)]);
    expect(rows).toBe(2);
  });

  test("dense: a later small widget fills a gap left by a wide one", () => {
    // 2×1 at the top left, 3×2 cannot fit beside it and goes below, the 1×1 fills the gap on the first row.
    const { cells } = packGrid(
      [
        { w: 2, h: 1 },
        { w: 3, h: 2 },
        { w: 1, h: 1 },
      ],
      3,
    );
    expect(cells).toEqual([at(0, 0, 2, 1), at(0, 1, 3, 2), at(2, 0, 1, 1)]);
  });

  test("a tall widget leaves room beside it for the next ones", () => {
    const { cells, rows } = packGrid(
      [
        { w: 1, h: 3 },
        { w: 2, h: 1 },
        { w: 2, h: 2 },
        { w: 3, h: 1 },
      ],
      3,
    );
    expect(cells).toEqual([at(0, 0, 1, 3), at(1, 0, 2, 1), at(1, 1, 2, 2), at(0, 3, 3, 1)]);
    expect(rows).toBe(4);
  });

  test("a widget wider than the grid takes its full width", () => {
    expect(packGrid([{ w: 3, h: 1 }], 2).cells).toEqual([at(0, 0, 2, 1)]);
  });
});

describe("gridRects", () => {
  test("pixel rectangles and total height for a width, row height and gap", () => {
    const { tiles, height } = gridRects(
      [
        { key: "a", size: { w: 3, h: 2 } },
        { key: "b", size: { w: 2, h: 1 } },
        { key: "c", size: { w: 1, h: 1 } },
      ],
      { width: 320, columns: 3, rowHeight: 64, gap: 10 },
    );
    expect(tiles.map((tile) => tile.item.key)).toEqual(["a", "b", "c"]);
    // Columns are (320 - 2 × 10) / 3 = 100 wide.
    expect(tiles.map((tile) => tile.rect)).toEqual([
      { left: 0, top: 0, width: 320, height: 138 },
      { left: 0, top: 148, width: 210, height: 64 },
      { left: 220, top: 148, width: 100, height: 64 },
    ]);
    expect(height).toBe(212);
  });

  test("no items, no height", () => {
    expect(gridRects([], { width: 320, columns: 3, rowHeight: 64, gap: 10 })).toEqual({ tiles: [], height: 0 });
  });
});

describe("gridHeight", () => {
  test("rows with the gaps between them", () => {
    expect(gridHeight(1, 22, 6)).toBe(22);
    expect(gridHeight(3, 22, 6)).toBe(78);
    expect(gridHeight(0, 22, 6)).toBe(0);
  });
});
