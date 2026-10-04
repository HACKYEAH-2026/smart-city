import { expect, test } from "bun:test";
import { t } from "../texts";
import { relativeTime } from "./relativeTime";

const now = new Date(2026, 9, 3, 10, 0); // local time, so the calendar days are the same on every machine
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

test("recent times are counted in minutes and hours", () => {
  expect(relativeTime(ago(20_000), now)).toBe(t.time_just_now);
  expect(relativeTime(ago(5 * 60_000), now)).toBe(`5 ${t.time_minutes_ago}`);
  expect(relativeTime(ago(2 * 60 * 60_000), now)).toBe(`2 ${t.time_hours_ago}`);
});

test("the day before is named, older times are dates", () => {
  expect(relativeTime(new Date(2026, 9, 2, 8, 0).toISOString(), now)).toBe(t.time_yesterday);
  expect(relativeTime(new Date(2026, 9, 1, 8, 0).toISOString(), now)).toBe("01.10.2026");
});

test("the short style for tight rows drops 'temu' and the year", () => {
  expect(relativeTime(ago(20_000), now, "short")).toBe(t.time_now);
  expect(relativeTime(ago(5 * 60_000), now, "short")).toBe(`5 ${t.time_minutes}`);
  expect(relativeTime(ago(2 * 60 * 60_000), now, "short")).toBe(`2 ${t.time_hours}`);
  expect(relativeTime(new Date(2026, 9, 2, 8, 0).toISOString(), now, "short")).toBe(t.time_yesterday);
  expect(relativeTime(new Date(2026, 9, 1, 8, 0).toISOString(), now, "short")).toBe("1 paź");
});
