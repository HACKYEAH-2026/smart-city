import type { PlaceMember } from "@app/shared";
import { format, isSameYear, parseISO } from "date-fns";
import { pl } from "date-fns/locale/pl";

/** The filter chips on the members screen. */
export type MemberFilter = "all" | "admins" | "members";

/** How a member is called in the app: their name, or their email when they have none. */
export const memberName = (member: PlaceMember): string => member.name || member.email;

/** The signed-in admin first, the rest in the API's order (admins, then by name). */
export const orderMembers = (list: PlaceMember[]): PlaceMember[] => [
  ...list.filter((member) => member.you),
  ...list.filter((member) => !member.you),
];

const FILTERS: Record<MemberFilter, (member: PlaceMember) => boolean> = {
  all: () => true,
  admins: (member) => member.role === "admin",
  members: (member) => member.role === "user",
};

/** The members a filter chip keeps whose name or email contains the query (any case). */
export function filterMembers(list: PlaceMember[], filter: MemberFilter, query: string): PlaceMember[] {
  const needle = query.trim().toLocaleLowerCase("pl");
  const matches = (member: PlaceMember) =>
    [member.name, member.email].some((text) => text.toLocaleLowerCase("pl").includes(needle));
  return list.filter((member) => FILTERS[filter](member) && matches(member));
}

/** How many members each filter chip keeps. */
export const memberCounts = (list: PlaceMember[]): Record<MemberFilter, number> => ({
  all: list.length,
  admins: list.filter(FILTERS.admins).length,
  members: list.filter(FILTERS.members).length,
});

/** The day a member joined: "3 paź", with the year when it is not this year ("3 paź 2025"). */
export function joinedDate(iso: string, now: Date = new Date()): string {
  const date = parseISO(iso);
  return format(date, isSameYear(date, now) ? "d MMM" : "d MMM yyyy", { locale: pl });
}
