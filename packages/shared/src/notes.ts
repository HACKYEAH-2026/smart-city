import { z } from "zod";

/**
 * Kontrakt zasobu "notes". Jedno źródło prawdy dla walidacji w API (zod-validator)
 * i w formularzach frontendu. Nowy zasób = skopiuj ten plik.
 * Komunikaty Zod są po angielsku (język API); UI pokazuje własne tłumaczenia z Paraglide.
 */
export const NOTE_TITLE_MAX = 200;
export const NOTE_BODY_MAX = 10_000;

const title = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(NOTE_TITLE_MAX, `Title must be at most ${NOTE_TITLE_MAX} characters`);
const body = z.string().max(NOTE_BODY_MAX, `Body must be at most ${NOTE_BODY_MAX} characters`);

export const noteCreateSchema = z.object({ title, body: body.default("") });
export const noteUpdateSchema = z
  .object({ title, body })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");
export const noteIdSchema = z.object({ id: z.uuid() });

export type NoteCreate = z.input<typeof noteCreateSchema>;
export type NoteUpdate = z.input<typeof noteUpdateSchema>;

/** Kształt notatki na drucie (JSON). Daty jako ISO string. */
export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};
