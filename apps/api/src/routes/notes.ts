import { schema } from "@app/db";
import { type Note, noteCreateSchema, noteIdSchema, noteUpdateSchema } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { requireUser } from "../middleware";

/**
 * WZORZEC ZASOBU. Nowy zasób: skopiuj ten plik + packages/shared/src/notes.ts
 * + tabelę w packages/db/src/schema.ts + test integracyjny apps/api/test/notes.test.ts.
 * Zasada autoryzacji: KAŻDE zapytanie filtruje po userId; cudzy rekord = 404 (nie 403).
 */
const { notes } = schema;

const toNote = (row: typeof notes.$inferSelect): Note => ({
  id: row.id,
  title: row.title,
  body: row.body,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const owned = (id: string, userId: string) => and(eq(notes.id, id), eq(notes.userId, userId));

export const notesRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", async (c) => {
    const rows = await c.var.db
      .select()
      .from(notes)
      .where(eq(notes.userId, c.var.user.id))
      .orderBy(desc(notes.createdAt));
    return c.json(rows.map(toNote));
  })
  .post("/", zValidator("json", noteCreateSchema), async (c) => {
    const [row] = await c.var.db
      .insert(notes)
      .values({ ...c.req.valid("json"), userId: c.var.user.id })
      .returning();
    if (!row) throw new Error("insert nie zwrócił wiersza");
    return c.json(toNote(row), 201);
  })
  .get("/:id", zValidator("param", noteIdSchema), async (c) => {
    const [row] = await c.var.db
      .select()
      .from(notes)
      .where(owned(c.req.valid("param").id, c.var.user.id));
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(toNote(row), 200);
  })
  .patch("/:id", zValidator("param", noteIdSchema), zValidator("json", noteUpdateSchema), async (c) => {
    const [row] = await c.var.db
      .update(notes)
      .set(c.req.valid("json"))
      .where(owned(c.req.valid("param").id, c.var.user.id))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(toNote(row), 200);
  })
  .delete("/:id", zValidator("param", noteIdSchema), async (c) => {
    const [row] = await c.var.db
      .delete(notes)
      .where(owned(c.req.valid("param").id, c.var.user.id))
      .returning({ id: notes.id });
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.body(null, 204);
  });
