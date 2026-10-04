import { differenceInHours, differenceInMinutes, format, isSameDay, parseISO, subDays } from "date-fns";
import { pl } from "date-fns/locale/pl";
import { t } from "../texts";

/** `long` in sentences and cards; `short` in tight rows (dashboard widgets). */
const WORDS = {
  long: { now: t.time_just_now, minutes: t.time_minutes_ago, hours: t.time_hours_ago, date: "P" },
  short: { now: t.time_now, minutes: t.time_minutes, hours: t.time_hours, date: "d MMM" },
} as const;

/**
 * When something happened, as the invitations show it: "przed chwilą", "5 min temu", "2 godz. temu", "wczoraj",
 * or the date for anything older. `short`: "teraz", "5 min", "2 godz.", "wczoraj", "1 paź".
 */
export function relativeTime(iso: string, now: Date = new Date(), style: keyof typeof WORDS = "long"): string {
  const words = WORDS[style];
  const then = parseISO(iso);
  const minutes = differenceInMinutes(now, then);
  if (minutes < 1) return words.now;
  if (minutes < 60) return `${minutes} ${words.minutes}`;
  const hours = differenceInHours(now, then);
  if (hours < 24) return `${hours} ${words.hours}`;
  if (isSameDay(then, subDays(now, 1))) return t.time_yesterday;
  return format(then, words.date, { locale: pl });
}
