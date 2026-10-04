import { expect, test } from "bun:test";
import { blockPlaces } from "./chatBlocks";

test("consecutive messages of one person make one block: the name on the first, the initials on the last", () => {
  const anna = { person: "Anna Nowak" };
  const me = { person: "Bartek", mine: true };
  expect(blockPlaces([anna, anna, anna, me, me, anna])).toEqual([
    { first: true, last: false },
    { first: false, last: false },
    { first: false, last: true },
    { first: true, last: false },
    { first: false, last: true },
    { first: true, last: true },
  ]);
});

test("the viewer's own message never joins a block of someone with the same name", () => {
  expect(blockPlaces([{ person: "Anna" }, { person: "Anna", mine: true }])).toEqual([
    { first: true, last: true },
    { first: true, last: true },
  ]);
  expect(blockPlaces([])).toEqual([]);
});
