import { differenceInHours, differenceInMinutes, format, isSameDay, parseISO, subDays } from "date-fns";
import { pl } from "date-fns/locale/pl";
import { t } from "../texts";

/**
 * When something happened, as the invitations show it: "przed chwilą", "5 min temu", "2 godz. temu", "wczoraj",
 * or the date for anything older.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = parseISO(iso);
  const minutes = differenceInMinutes(now, then);
  if (minutes < 1) return t.time_just_now;
  if (minutes < 60) return `${minutes} ${t.time_minutes_ago}`;
  const hours = differenceInHours(now, then);
  if (hours < 24) return `${hours} ${t.time_hours_ago}`;
  if (isSameDay(then, subDays(now, 1))) return t.time_yesterday;
  return format(then, "P", { locale: pl });
}
