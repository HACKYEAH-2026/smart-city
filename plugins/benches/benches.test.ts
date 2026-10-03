import { expect, test } from "bun:test";
import { testPlugin, textsOf } from "@app/plugin-sdk/testing";
import benches from "./index";

test("benches: reported bench appears on the list", async () => {
  const t = testPlugin(benches);
  expect(textsOf(await t.view("main"))).toContain("Wszystkie ławki są całe.");
  const res = await t.tool("report", { park: "Park Jordana", problem: "Złamane oparcie" });
  expect(res).toEqual({ toast: "Dziękujemy! Ławka trafiła na listę.", refresh: true });
  expect(textsOf(await t.view("main"))).toEqual(expect.arrayContaining(["Park Jordana", "Złamane oparcie"]));
});
