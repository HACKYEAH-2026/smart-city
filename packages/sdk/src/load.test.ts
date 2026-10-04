import { describe, expect, test } from "bun:test";
import { loadPlugin } from "./load";
import type { DashboardWidgetSize, PluginSdk } from "./plugin";

// Untyped on purpose: the loader must reject at runtime what the types would reject at compile time.
const withWidget = (widget: object) => (sdk: PluginSdk) => ({
  id: "tiles",
  name: "Kafelki",
  version: "1.0.0",
  nav: [{ view: "main", label: "Kafelki" }],
  views: { main: () => sdk.ui.screen("Kafelki", []) },
  dashboardWidgets: { w: { ...widget, render: () => null } },
});

describe("dashboard widgets", () => {
  test("a size up to the 3-column width, an optional title and other sizes are accepted", () => {
    const sizes: DashboardWidgetSize[] = [
      { w: 1, h: 1 },
      { w: 2, h: 2 },
    ];
    const { definition } = loadPlugin(withWidget({ size: { w: 3, h: 3 }, title: "Kafelek", sizes }));
    expect(definition.dashboardWidgets?.w?.sizes).toEqual(sizes);
  });

  test("an invalid size, title or list of sizes is rejected", () => {
    const rejects = (widget: object) =>
      expect(() => loadPlugin(withWidget(widget))).toThrow(
        'Dashboard widget "w" must have a size ({ w: 1-3, h: 1-3 })',
      );
    rejects({ size: { w: 4, h: 1 } });
    rejects({ size: { w: 1, h: 1 }, title: "" });
    rejects({ size: { w: 1, h: 1 }, title: "x".repeat(61) });
    // The host shows the title as written, so its length counts with the spaces around it.
    rejects({ size: { w: 1, h: 1 }, title: `${" ".repeat(1000)}X` });
    rejects({ size: { w: 1, h: 1 }, title: "   " });
    rejects({ size: { w: 1, h: 1 }, sizes: [{ w: 1, h: 4 }] });
    rejects({ size: { w: 1, h: 1 }, sizes: Array.from({ length: 7 }, () => ({ w: 1, h: 1 })) });
  });
});
