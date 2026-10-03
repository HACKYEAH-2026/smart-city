import { describe, expect, test } from "bun:test";
import { deniedService } from "./denied";
import type { PluginModule } from "./plugin";
import type { Database } from "./services/db";
import { testPlugin } from "./testing";

describe("undeclared permissions", () => {
  test("any use of a denied service rejects with the permission name, at any depth", async () => {
    const db = deniedService<Database>("db");
    await expect(db.items?.findMany()).rejects.toThrow('did not declare the "db" permission');
    expect(await Promise.resolve(db).then(() => "awaited")).toBe("awaited");
  });

  test("the harness denies services the manifest does not declare, like the host", async () => {
    const notes: PluginModule = ({ definePlugin, ui, z, t }) =>
      definePlugin({
        id: "notes",
        name: "Notatki",
        version: "1.0.0",
        icon: "📝",
        description: "Test",
        permissions: [],
        nav: [{ view: "main", label: "Notatki" }],
        tables: { notes: t.table({ text: t.text() }) },
        views: { main: () => ui.screen("Notatki", []) },
        tools: {
          add: {
            description: "Dodaj",
            input: z.object({}),
            handler: async (ctx) => {
              await ctx.db.notes.insert({ text: "x" });
            },
          },
        },
      });
    const plugin = await testPlugin(notes);
    await expect(plugin.tool("add")).rejects.toThrow('did not declare the "db" permission');
  });
});

describe("ctx.notify in the harness", () => {
  const sightings: PluginModule = ({ definePlugin, ui, z }) =>
    definePlugin({
      id: "sightings",
      name: "Uwaga, dzik!",
      version: "1.0.0",
      permissions: ["notify"],
      nav: [{ view: "main", label: "Dziki" }],
      views: { main: () => ui.screen("Dziki", []), sighting: () => ui.screen("Dzik", []) },
      tools: {
        report: {
          description: "Zgłoś dzika",
          input: z.object({ lat: z.number(), lng: z.number(), view: z.string().default("sighting") }),
          handler: async (ctx, input) => {
            await ctx.notify({
              to: { near: { lat: input.lat, lng: input.lng, radius: 500 } },
              title: "Uwaga, dzik!",
              tone: "danger",
              open: ui.navigate(input.view, { id: "1" }),
            });
          },
        },
      },
    });

  test("records what the plugin sent (validated, defaults applied), with the sender", async () => {
    const plugin = await testPlugin(sightings);
    expect(plugin.notifications()).toEqual([]);
    await plugin.as({ id: "anna", name: "Anna", role: "user" }).tool("report", { lat: 50.02, lng: 19.9 });
    expect(plugin.notifications()).toEqual([
      {
        from: "anna",
        to: { near: { lat: 50.02, lng: 19.9, radius: 500 } },
        title: "Uwaga, dzik!",
        body: "",
        tone: "danger",
        open: { type: "navigate", view: "sighting", params: { id: "1" } },
      },
    ]);
  });

  test("rejects like the host: a view that does not exist, coordinates out of range", async () => {
    const plugin = await testPlugin(sightings);
    await expect(plugin.tool("report", { lat: 50, lng: 19.9, view: "missing" })).rejects.toThrow(
      'unknown view "missing"',
    );
    await expect(plugin.tool("report", { lat: 95, lng: 19.9 })).rejects.toThrow();
    expect(plugin.notifications()).toEqual([]);
  });
});
