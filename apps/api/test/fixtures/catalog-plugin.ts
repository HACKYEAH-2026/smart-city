import type { PluginModule } from "@app/plugin-sdk";

/**
 * A plugin for tests of what the host does with the UI catalog (apps/api/test sends this file's source to
 * POST /api/admin/plugins): an admin view, a widget that shows the size it is drawn at, and photos in a Gallery, a
 * Card and an ImagePicker (`?photo=<FileId>`). A test fixture, not a product feature.
 */
const catalog: PluginModule = ({ definePlugin, ui }) =>
  definePlugin({
    id: "catalog",
    name: "Katalog",
    version: "1.0.0",
    permissions: ["files"],
    nav: [{ view: "main", label: "Katalog" }],
    adminView: "admin",
    dashboardWidgets: {
      tile: {
        size: { w: 3, h: 2 },
        sizes: [{ w: 3, h: 3 }],
        render: (_ctx, frame) => ui.widget("Katalog", [ui.text(`Rozmiar ${frame.size.w}x${frame.size.h}`)]),
      },
    },
    views: {
      main: (_ctx, params) => {
        const file = params.photo ?? "";
        return ui.screen("Katalog", [
          ui.gallery([{ file, alt: "Zdjęcie" }]),
          ui.list("Lista", [ui.card({ title: "Karta", image: { file, alt: "Miniatura", more: 1 } })]),
          ui.form({
            submitLabel: "Wyślij",
            submit: ui.tool("send"),
            children: [ui.imagePicker({ name: "photos", label: "Zdjęcia", max: 3, value: [{ file }] })],
          }),
        ]);
      },
      admin: () => ui.screen("Panel", [ui.stat("aktywnych", "8", "success")]),
    },
  });

export default catalog;
