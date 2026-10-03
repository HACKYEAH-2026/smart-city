import { createHmac, timingSafeEqual } from "node:crypto";
import { FILE_ID, type FileId, type Files } from "@app/plugin-sdk";
import { and, eq, lt } from "drizzle-orm";
import { type Db, schema } from "../../db";
import type { FileStore } from "./store";

const { pluginFiles } = schema;

export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const FILE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const URL_TTL_S = 60 * 60;

/** User input error (e.g. someone else's or a nonexistent file) → HTTP 400. */
export class FileInputError extends Error {}

/**
 * Plugin files: upload (pending) → ctx.files.keep() (kept) → display via a signed URL.
 * Bytes in FileStore, metadata and owner in the plugin_files table.
 */
export class FileService {
  constructor(
    private readonly db: Db,
    private readonly store: FileStore,
    private readonly secret: string,
    private readonly apiUrl: string,
  ) {}

  async upload(args: { installationId: string; userId: string; mime: string; data: Uint8Array }): Promise<FileId> {
    if (!(FILE_MIMES as readonly string[]).includes(args.mime)) throw new FileInputError("unsupported_type");
    if (args.data.byteLength > FILE_MAX_BYTES) throw new FileInputError("too_large");
    await this.sweep();
    const id = `file_${crypto.randomUUID()}` as FileId;
    await this.store.put(id, args.data);
    await this.db.insert(pluginFiles).values({
      id,
      installationId: args.installationId,
      uploadedBy: args.userId,
      mime: args.mime,
      size: args.data.byteLength,
    });
    return id;
  }

  /** ctx.files for a single installation and user. */
  forPlugin(installationId: string, userId: string | null): Files {
    const own = async (id: FileId) => {
      if (!FILE_ID.test(id)) throw new FileInputError(`invalid file id ${id}`);
      const [row] = await this.db
        .select()
        .from(pluginFiles)
        .where(and(eq(pluginFiles.id, id), eq(pluginFiles.installationId, installationId)));
      if (!row) throw new FileInputError(`unknown file ${id}`);
      return row;
    };
    return {
      keep: async (id) => {
        const row = await own(id);
        if (row.status === "kept") return;
        if (row.uploadedBy !== userId) throw new FileInputError(`file ${id} belongs to another user`);
        await this.db.update(pluginFiles).set({ status: "kept" }).where(eq(pluginFiles.id, id));
      },
      info: async (id) => {
        const row = await own(id);
        return { mime: row.mime, size: row.size };
      },
      remove: async (id) => {
        await own(id);
        await this.db.delete(pluginFiles).where(eq(pluginFiles.id, id));
        await this.store.delete(id);
      },
    };
  }

  /** File bytes and type for the AI model (only this installation's files). */
  async read(installationId: string, id: string): Promise<{ mime: string; data: Uint8Array } | null> {
    const [row] = await this.db
      .select()
      .from(pluginFiles)
      .where(and(eq(pluginFiles.id, id), eq(pluginFiles.installationId, installationId)));
    if (!row) return null;
    const data = await this.store.get(id);
    return data ? { mime: row.mime, data } : null;
  }

  /** Signed, short-lived URL (works in <Image> without an Authorization header). */
  signedUrl(id: string, now = Date.now()): string {
    const exp = Math.floor(now / 1000) + URL_TTL_S;
    return `${this.apiUrl}/api/files/${id}?exp=${exp}&sig=${this.sign(id, exp)}`;
  }

  async serve(id: string, exp: string, sig: string, now = Date.now()) {
    const expNum = Number(exp);
    if (!FILE_ID.test(id) || !Number.isFinite(expNum) || expNum * 1000 < now) return null;
    const expected = Buffer.from(this.sign(id, expNum));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const [row] = await this.db.select().from(pluginFiles).where(eq(pluginFiles.id, id));
    if (!row) return null;
    const data = await this.store.get(id);
    return data ? { mime: row.mime, data } : null;
  }

  /** Deletes unconfirmed uploads older than 24 h (called on every upload). */
  async sweep(now = Date.now()) {
    const stale = await this.db
      .delete(pluginFiles)
      .where(and(eq(pluginFiles.status, "pending"), lt(pluginFiles.createdAt, new Date(now - PENDING_TTL_MS))))
      .returning({ id: pluginFiles.id });
    await Promise.all(stale.map((f) => this.store.delete(f.id)));
  }

  private sign(id: string, exp: number) {
    return createHmac("sha256", this.secret).update(`${id}.${exp}`).digest("base64url");
  }
}
