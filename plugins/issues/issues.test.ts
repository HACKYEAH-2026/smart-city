import { describe, expect, test } from "bun:test";
import { testPlugin, textsOf } from "@app/plugin-sdk/testing";
import issues from "./index";

const alice = { id: "alice", name: "Alice" };
const bob = { id: "bob", name: "Bob" };

describe("issues", () => {
  test("pusta lista, zgłoszenie, szczegóły", async () => {
    const t = testPlugin(issues, { user: alice });
    expect(textsOf(await t.view("list"))).toContain("Nie ma jeszcze zgłoszeń. Zgłoś pierwszą usterkę.");

    const res = await t.tool("report", { title: "Nie świeci latarnia", category: "lighting", description: "Długa 12" });
    expect(res.toast).toContain("Dziękujemy");
    expect(res.navigate?.view).toBe("detail");

    const detail = await t.view("detail", res.navigate!.params);
    expect(textsOf(detail)).toEqual(expect.arrayContaining(["Nie świeci latarnia", "Długa 12", "1 osoba popiera"]));
    expect(textsOf(detail)).toContain("Popierasz to zgłoszenie");
  });

  test("podobne zgłoszenie w tej samej kategorii dokłada poparcie", async () => {
    const t = testPlugin(issues, { user: alice });
    const first = await t.tool("report", { title: "Latarnia Długa nie świeci", category: "lighting" });
    const dup = await t.as(bob).tool("report", { title: "nie świeci latarnia", category: "lighting" });
    expect(dup.toast).toContain("już istnieje");
    expect(dup.navigate?.params).toEqual(first.navigate!.params!);
    expect(await t.storage.list("issues")).toHaveLength(1);
  });

  test("inna kategoria to nowe zgłoszenie", async () => {
    const t = testPlugin(issues, { user: alice });
    await t.tool("report", { title: "Latarnia Długa nie świeci", category: "lighting" });
    await t.as(bob).tool("report", { title: "Latarnia Długa nie świeci", category: "other" });
    expect(await t.storage.list("issues")).toHaveLength(2);
  });

  test("+1 jest idempotentne", async () => {
    const t = testPlugin(issues, { user: alice });
    const { navigate } = await t.tool("report", { title: "Dziura w chodniku", category: "roads" });
    const id = navigate!.params!.id!;
    await t.as(bob).tool("upvote", { id });
    await t.as(bob).tool("upvote", { id });
    expect(textsOf(await t.as(bob).view("detail", { id }))).toContain("2 osób popiera");
  });

  test("walidacja wejścia", () => {
    const t = testPlugin(issues);
    expect(t.invalidInput("report", { title: "x", category: "nie-ma" })?.map((i) => i.path[0])).toEqual([
      "title",
      "category",
    ]);
    expect(t.invalidInput("report", { title: "Latarnia" })).toBeNull();
  });
});
