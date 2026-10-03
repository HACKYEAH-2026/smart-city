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
