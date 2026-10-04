import { describe, expect, test } from "bun:test";
import type { PlaceMember } from "@app/shared";
import { filterMembers, joinedDate, memberCounts, memberName, orderMembers } from "./members";

const member = (id: string, extra: Partial<PlaceMember> = {}): PlaceMember => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role: "user",
  joinedAt: null,
  you: false,
  ...extra,
});

const list = [
  member("tomasz", { name: "Tomasz Kamiński", role: "admin" }),
  member("jan", { name: "Jan Kowalski", role: "admin", you: true }),
  member("anna", { name: "Anna Nowak" }),
  member("ewa", { name: "" }),
];

describe("orderMembers", () => {
  test("you first, the rest in the given order", () => {
    expect(orderMembers(list).map((m) => m.id)).toEqual(["jan", "tomasz", "anna", "ewa"]);
  });
});

describe("filterMembers", () => {
  test("by role", () => {
    expect(filterMembers(list, "all", "").map((m) => m.id)).toEqual(["tomasz", "jan", "anna", "ewa"]);
    expect(filterMembers(list, "admins", "").map((m) => m.id)).toEqual(["tomasz", "jan"]);
    expect(filterMembers(list, "members", "").map((m) => m.id)).toEqual(["anna", "ewa"]);
  });

  test("by name or email, any case, ignoring spaces around the query", () => {
    expect(filterMembers(list, "all", "  KAMIŃ ").map((m) => m.id)).toEqual(["tomasz"]);
    expect(filterMembers(list, "all", "ewa@").map((m) => m.id)).toEqual(["ewa"]);
    expect(filterMembers(list, "members", "tomasz")).toEqual([]);
  });
});

describe("memberCounts", () => {
  test("everyone, admins and plain members", () => {
    expect(memberCounts(list)).toEqual({ all: 4, admins: 2, members: 2 });
    expect(memberCounts([])).toEqual({ all: 0, admins: 0, members: 0 });
  });
});

describe("memberName", () => {
  test("the name, else the email", () => {
    expect(memberName(list[0] ?? member("x"))).toBe("Tomasz Kamiński");
    expect(memberName(member("ewa", { name: "" }))).toBe("ewa@example.test");
  });
});

describe("joinedDate", () => {
  const now = new Date(2026, 9, 4, 12);
  test("day and short month in Polish; the year only when it is not this year", () => {
    expect(joinedDate(new Date(2026, 9, 3, 12).toISOString(), now)).toBe("3 paź");
    expect(joinedDate(new Date(2025, 9, 3, 12).toISOString(), now)).toBe("3 paź 2025");
    expect(joinedDate(new Date(2026, 0, 15, 12).toISOString(), now)).toBe("15 sty");
  });
});
