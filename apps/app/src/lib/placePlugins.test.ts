import { describe, expect, test } from "bun:test";
import type { PlacePlugin } from "@app/shared";
import { t } from "../texts";
import { catalogPlugins, enabledPlugins, pluginSubtitle } from "./placePlugins";

const plugin = (overrides: Partial<PlacePlugin>): PlacePlugin => ({
  id: "issues",
  name: "Zgłoszenia",
  icon: "📣",
  description: "Usterki i sugestie mieszkańców.",
  enabled: false,
  madeByAi: false,
  draft: false,
  working: false,
  widgets: 1,
  ...overrides,
});

const PLUGINS = [
  plugin({ id: "issues", enabled: true }),
  plugin({ id: "discussions", name: "Dyskusje", description: "Forum społeczności." }),
  plugin({ id: "announcements", name: "Ogłoszenia", description: "Komunikaty administratorów." }),
  plugin({ id: "ai-draft", name: "Szkic", madeByAi: true, draft: true }),
];
const ids = (list: PlacePlugin[]) => list.map((p) => p.id);

describe("enabledPlugins", () => {
  test("only the ones that are on", () => {
    expect(ids(enabledPlugins(PLUGINS))).toEqual(["issues"]);
  });
});

describe("catalogPlugins", () => {
  test("the ones not on yet, without drafts", () => {
    expect(ids(catalogPlugins(PLUGINS, ""))).toEqual(["discussions", "announcements"]);
  });

  test("search by name or description, any case, trimmed", () => {
    expect(ids(catalogPlugins(PLUGINS, " DYSK "))).toEqual(["discussions"]);
    expect(ids(catalogPlugins(PLUGINS, "administratorów"))).toEqual(["announcements"]);
    expect(ids(catalogPlugins(PLUGINS, "nic takiego"))).toEqual([]);
  });
});

describe("pluginSubtitle", () => {
  test("widgets and the description", () => {
    expect(pluginSubtitle(plugin({ widgets: 3 }))).toBe("3 widżety · Usterki i sugestie mieszkańców.");
  });

  test("an AI plugin is marked; an empty description is left out", () => {
    expect(pluginSubtitle(plugin({ madeByAi: true, description: "", widgets: 2 }))).toBe(
      `${t.build_made_by_ai} · 2 widżety`,
    );
  });

  test("no widgets: no count", () => {
    expect(pluginSubtitle(plugin({ widgets: 0 }))).toBe("Usterki i sugestie mieszkańców.");
    expect(pluginSubtitle(plugin({ madeByAi: true, description: "", widgets: 0 }))).toBe(t.build_made_by_ai);
  });
});
