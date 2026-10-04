import { describe, expect, test } from "bun:test";
import { deniedService } from "./denied";
import type { PluginModule } from "./plugin";
import type { Database } from "./services/db";
import { testPlugin, textsOf } from "./testing";

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
        dashboardWidgets: { tile: { size: { w: 1, h: 1 }, render: () => ui.widget("Notatki", []) } },
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
      dashboardWidgets: { tile: { size: { w: 1, h: 1 }, render: () => ui.widget("Dziki", []) } },
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

describe("ctx.ai.embed in the harness", () => {
  const lookalike: PluginModule = ({ definePlugin, ui, z }) =>
    definePlugin({
      id: "lookalike",
      name: "Podobne",
      version: "1.0.0",
      permissions: ["ai"],
      nav: [{ view: "main", label: "Podobne" }],
      views: { main: () => ui.screen("Podobne", []) },
      dashboardWidgets: { tile: { size: { w: 1, h: 1 }, render: () => ui.widget("Podobne", []) } },
      tools: {
        embed: {
          description: "Wektor tekstu",
          input: z.object({ text: z.string() }),
          handler: async (ctx, input) => ({ data: { vector: await ctx.ai.embed(input.text) } }),
        },
      },
    });

  test("no mock: fails with a hint; with mockEmbed: the mocked vector", async () => {
    const plugin = await testPlugin(lookalike);
    await expect(plugin.tool("embed", { text: "Latarnia" })).rejects.toThrow("t.ai.mockEmbed");
    plugin.ai.mockEmbed((text) => [text.length, 1]);
    expect((await plugin.tool("embed", { text: "Latarnia" })).data).toEqual({ vector: [8, 1] });
  });
});

describe("dashboard widget frame in the harness", () => {
  const sized: PluginModule = ({ definePlugin, ui }) =>
    definePlugin({
      id: "sized",
      name: "Rozmiary",
      version: "1.0.0",
      nav: [{ view: "main", label: "Rozmiary" }],
      views: { main: () => ui.screen("Rozmiary", []) },
      dashboardWidgets: {
        tile: {
          size: { w: 3, h: 2 },
          sizes: [{ w: 3, h: 3 }],
          render: (_ctx, frame) => ui.widget("Rozmiary", [ui.text(`${frame.size.w}x${frame.size.h}`)]),
        },
      },
    });

  test("render gets the declared size by default, or a size the widget offers", async () => {
    const plugin = await testPlugin(sized);
    expect(textsOf(await plugin.dashboardWidget("tile"))).toContain("3x2");
    expect(textsOf(await plugin.dashboardWidget("tile", { size: { w: 3, h: 3 } }))).toContain("3x3");
  });

  test("a size the widget does not offer is rejected, as an admin could not pick it", async () => {
    const plugin = await testPlugin(sized);
    await expect(plugin.dashboardWidget("tile", { size: { w: 1, h: 1 } })).rejects.toThrow("does not offer");
  });
});

describe("ctx.ai.call timeoutMs in the harness", () => {
  const asker: PluginModule = ({ definePlugin, ui, z }) =>
    definePlugin({
      id: "asker",
      name: "Pytania",
      version: "1.0.0",
      permissions: ["ai"],
      nav: [{ view: "main", label: "Pytania" }],
      views: { main: () => ui.screen("Pytania", []) },
      dashboardWidgets: { tile: { size: { w: 1, h: 1 }, render: () => ui.widget("Pytania", []) } },
      tools: {
        ask: {
          description: "Zapytaj model",
          input: z.object({ timeoutMs: z.number().optional() }),
          handler: async (ctx, input) => {
            const answer = await ctx.ai
              .call({ prompt: "Kategoria?", ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}) })
              .catch((err: Error) => `błąd: ${err.message}`);
            return { data: { answer } };
          },
        },
      },
    });

  test("mockTimeout: a call with timeoutMs times out at once; one without it is reported as hanging", async () => {
    const plugin = await testPlugin(asker);
    plugin.ai.mockTimeout();
    expect((await plugin.tool("ask", { timeoutMs: 3000 })).data).toEqual({
      answer: "błąd: ctx.ai.call timed out after 3000 ms",
    });
    expect(JSON.stringify((await plugin.tool("ask")).data)).toContain("has no timeoutMs");
  });

  test("timeoutMs is enforced on a mock that answers late, as in the host", async () => {
    const plugin = await testPlugin(asker);
    plugin.ai.mockCall(() => new Promise((resolve) => setTimeout(() => resolve("późno"), 200)));
    expect((await plugin.tool("ask", { timeoutMs: 10 })).data).toEqual({
      answer: "błąd: ctx.ai.call timed out after 10 ms",
    });
    plugin.ai.mockCall(async () => "szybko");
    expect((await plugin.tool("ask", { timeoutMs: 1000 })).data).toEqual({ answer: "szybko" });
  });
});

describe("ctx.files.info in the harness", () => {
  test("says who uploaded a file and whether a row keeps it, like the host", async () => {
    const photos: PluginModule = ({ definePlugin, ui, z, t, fileRef }) =>
      definePlugin({
        id: "photos",
        name: "Zdjęcia",
        version: "1.0.0",
        permissions: ["db", "files"],
        nav: [{ view: "main", label: "Zdjęcia" }],
        tables: { photos: t.table({ file: t.ref("file") }) },
        views: { main: () => ui.screen("Zdjęcia", []) },
        dashboardWidgets: { tile: { size: { w: 1, h: 1 }, render: () => ui.widget("Zdjęcia", []) } },
        tools: {
          keep: {
            description: "Zachowaj",
            input: z.object({ file: fileRef() }),
            handler: async (ctx, { file }) => {
              await ctx.db.photos.insert({ file });
            },
          },
          info: {
            description: "Info",
            input: z.object({ file: fileRef() }),
            handler: async (ctx, { file }) => ({ data: await ctx.files.info(file) }),
          },
        },
      });
    const plugin = await testPlugin(photos, { user: { id: "anna", name: "Anna", role: "user" } });
    const file = await plugin.files.fake("image/png");
    expect((await plugin.tool("info", { file })).data).toEqual({
      mime: "image/png",
      size: 1024,
      uploadedBy: "anna",
      kept: false,
    });
    await plugin.tool("keep", { file });
    expect((await plugin.tool("info", { file })).data).toMatchObject({ uploadedBy: "anna", kept: true });
  });
});
