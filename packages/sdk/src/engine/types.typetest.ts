/**
 * Compile-time checks of the typed `ctx.db` (verified by `tsc`, never executed): each `@ts-expect-error`
 * line must be a type error, and the other lines must type-check.
 */
import { definePlugin } from "../plugin";
import { t } from "../services/db";
import { ui } from "../ui";

definePlugin({
  id: "typecheck",
  name: "Typecheck",
  version: "1.0.0",
  nav: [{ view: "main", label: "Main" }],
  tables: {
    issues: t.table({
      title: t.text(),
      status: t.enum(["open", "fixed"]).default("open"),
      reporter: t.ref("user"),
      photo: t.ref("file").optional(),
    }),
    reports: t.table({ issue: t.ref("issues"), note: t.text().default("") }),
  },
  views: {
    main: async (ctx) => {
      await ctx.db.issues.insert({ title: "ok", reporter: ctx.user.id });
      // @ts-expect-error title is required
      await ctx.db.issues.insert({ reporter: ctx.user.id });
      // @ts-expect-error status must be one of the enum values
      await ctx.db.issues.insert({ title: "x", reporter: ctx.user.id, status: "closed" });
      // @ts-expect-error unknown table
      await ctx.db.nope.findMany();

      const issues = await ctx.db.issues.findMany({ where: { status: "open" }, with: { reporter: true } });
      const status: "open" | "fixed" = issues[0]!.status;
      const reporterName: string = issues[0]!.reporter.name;
      // @ts-expect-error photo is nullable
      const photoId: string = issues[0]!.photo;
      // @ts-expect-error where on an unknown column
      await ctx.db.issues.findMany({ where: { nope: 1 } });
      // @ts-expect-error only reference columns can be expanded
      await ctx.db.issues.findMany({ with: { title: true } });

      const [report] = await ctx.db.reports.findMany({ with: { issue: true } });
      const issueTitle: string | undefined = report?.issue.title;
      return ui.screen(`${status} ${reporterName} ${photoId} ${issueTitle}`, []);
    },
  },
});
