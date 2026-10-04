import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  format,
  isSameDay,
  isSameYear,
  parseISO,
  subDays,
} from "date-fns";
import { pl } from "date-fns/locale/pl";
import { t } from "../texts";

/** `long` in sentences and cards; `short` in tight rows (dashboard widgets). */
const WORDS = {
  long: { now: t.time_just_now, minutes: t.time_minutes_ago, hours: t.time_hours_ago, date: "P" },
  short: { now: t.time_now, minutes: t.time_minutes, hours: t.time_hours, date: "d MMM" },
} as const;

/** Up to this many calendar days back, `long` counts days and weeks ("3 dni temu", "2 tyg. temu"); then a date. */
const LONG_DAYS = 35;

/**
 * When something happened: "przed chwilą", "5 min temu", "2 godz. temu", "wczoraj", then (`long`) "3 dni temu",
 * "1 tydz. temu", "2 tyg. temu", or the date for anything older. `short`: "teraz", "5 min", "2 godz.", "wczoraj",
 * "1 paź".
 */
export function relativeTime(iso: string, now: Date = new Date(), style: keyof typeof WORDS = "long"): string {
  const words = WORDS[style];
  const then = parseISO(iso);
  const minutes = differenceInMinutes(now, then);
  if (minutes < 1) return words.now;
  if (minutes < 60) return `${minutes} ${words.minutes}`;
  const hours = differenceInHours(now, then);
  if (hours < 24) return `${hours} ${words.hours}`;
  const days = differenceInCalendarDays(now, then);
  if (days === 1) return t.time_yesterday;
  if (style === "long" && days < LONG_DAYS) return daysAgo(days);
  return format(then, words.date, { locale: pl });
}

/** 2–6 days: "3 dni temu"; a week or more: "1 tydz. temu", "2 tyg. temu" (whole weeks). */
function daysAgo(days: number): string {
  const weeks = Math.floor(days / 7);
  if (weeks === 0) return `${days} ${t.time_days_ago}`;
  return `${weeks} ${weeks === 1 ? t.time_week_ago : t.time_weeks_ago}`;
}

/** A message's time in a chat: "14:05" today, "wczoraj, 14:05", "1 paź, 14:05", "1 paź 2025, 14:05". */
export function messageTime(iso: string, now: Date = new Date()): string {
  const then = parseISO(iso);
  const time = format(then, "HH:mm");
  if (isSameDay(then, now)) return time;
  if (isSameDay(then, subDays(now, 1))) return `${t.time_yesterday}, ${time}`;
  return format(then, isSameYear(then, now) ? "d MMM, HH:mm" : "d MMM yyyy, HH:mm", { locale: pl });
}
