import { expect, test } from "bun:test";
import { t } from "../texts";
import { messageTime, relativeTime } from "./relativeTime";

const now = new Date(2026, 9, 3, 10, 0); // local time, so the calendar days are the same on every machine
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

test("recent times are counted in minutes and hours", () => {
  expect(relativeTime(ago(20_000), now)).toBe(t.time_just_now);
  expect(relativeTime(ago(5 * 60_000), now)).toBe(`5 ${t.time_minutes_ago}`);
  expect(relativeTime(ago(2 * 60 * 60_000), now)).toBe(`2 ${t.time_hours_ago}`);
});

test("the day before is named, then days and weeks are counted, then older times are dates", () => {
  expect(relativeTime(new Date(2026, 9, 2, 8, 0).toISOString(), now)).toBe(t.time_yesterday);
  expect(relativeTime(new Date(2026, 9, 1, 8, 0).toISOString(), now)).toBe(`2 ${t.time_days_ago}`);
  expect(relativeTime(new Date(2026, 8, 27, 8, 0).toISOString(), now)).toBe(`6 ${t.time_days_ago}`);
  expect(relativeTime(new Date(2026, 8, 26, 8, 0).toISOString(), now)).toBe(`1 ${t.time_week_ago}`);
  expect(relativeTime(new Date(2026, 8, 19, 8, 0).toISOString(), now)).toBe(`2 ${t.time_weeks_ago}`);
  expect(relativeTime(new Date(2026, 7, 30, 8, 0).toISOString(), now)).toBe(`4 ${t.time_weeks_ago}`);
  expect(relativeTime(new Date(2026, 7, 29, 8, 0).toISOString(), now)).toBe("29.08.2026");
});

test("the short style for tight rows drops 'temu' and the year", () => {
  expect(relativeTime(ago(20_000), now, "short")).toBe(t.time_now);
  expect(relativeTime(ago(5 * 60_000), now, "short")).toBe(`5 ${t.time_minutes}`);
  expect(relativeTime(ago(2 * 60 * 60_000), now, "short")).toBe(`2 ${t.time_hours}`);
  expect(relativeTime(new Date(2026, 9, 2, 8, 0).toISOString(), now, "short")).toBe(t.time_yesterday);
  expect(relativeTime(new Date(2026, 9, 1, 8, 0).toISOString(), now, "short")).toBe("1 paź");
});

test("a chat message shows its clock time, with the day when it was not today", () => {
  expect(messageTime(new Date(2026, 9, 3, 9, 5).toISOString(), now)).toBe("09:05");
  expect(messageTime(new Date(2026, 9, 2, 21, 30).toISOString(), now)).toBe(`${t.time_yesterday}, 21:30`);
  expect(messageTime(new Date(2026, 8, 28, 8, 0).toISOString(), now)).toBe("28 wrz, 08:00");
  expect(messageTime(new Date(2025, 11, 31, 23, 59).toISOString(), now)).toBe("31 gru 2025, 23:59");
});
