import { createHmac, timingSafeEqual } from "node:crypto";
import { FILE_ID, type FileId, type Files } from "@app/plugin-sdk";
import { RecordId } from "surrealdb";
import { type Db, TABLES } from "../../db";
import type { FileStore } from "./store";

type FileRow = { mime: string; size: number; installation: RecordId };
const fileRecord = (id: string) => new RecordId(TABLES.file, id);
const installationRecord = (id: string) => new RecordId(TABLES.installation, id);

export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const FILE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const URL_TTL_S = 60 * 60;

/** User input error (e.g. someone else's or a nonexistent file) → HTTP 400. */
export class FileInputError extends Error {}

/**
 * Plugin files: upload (pending) → a plugin row references it via t.ref("file"), which confirms it (kept;
 * done by the db engine) → display via a signed URL. Unreferenced uploads are swept after 24 h.
 * Bytes in FileStore, metadata and owner in the plugin_file table.
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
    await this.db.query("CREATE $f CONTENT $data;", {
      f: fileRecord(id),
      data: {
        installation: installationRecord(args.installationId),
        uploaded_by: new RecordId(TABLES.user, args.userId),
        mime: args.mime,
        size: args.data.byteLength,
      },
    });
    return id;
  }

  /** ctx.files for a single installation and user. */
  forPlugin(installationId: string): Files {
    const own = async (id: FileId) => {
      if (!FILE_ID.test(id)) throw new FileInputError(`invalid file id ${id}`);
      const row = await this.row(id);
      if (!row || String(row.installation.id) !== installationId) throw new FileInputError(`unknown file ${id}`);
      return row;
    };
    return {
      info: async (id) => {
        const row = await own(id);
        return { mime: row.mime, size: row.size };
      },
      remove: async (id) => {
        await own(id);
        await this.db.query("DELETE $f;", { f: fileRecord(id) });
        await this.store.delete(id);
      },
    };
  }

  /** File bytes and type for the AI model (only this installation's files). */
  async read(installationId: string, id: string): Promise<{ mime: string; data: Uint8Array } | null> {
    const row = await this.row(id);
    if (!row || String(row.installation.id) !== installationId) return null;
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
    const row = await this.row(id);
    if (!row) return null;
    const data = await this.store.get(id);
    return data ? { mime: row.mime, data } : null;
  }

  /** Deletes unconfirmed uploads older than 24 h (called on every upload). */
  async sweep(now = Date.now()) {
    const [stale] = await this.db.query<[{ id: RecordId }[]]>(
      `DELETE ${TABLES.file} WHERE status = "pending" AND created_at < $cutoff RETURN BEFORE;`,
      { cutoff: new Date(now - PENDING_TTL_MS) },
    );
    await Promise.all(stale.map((f) => this.store.delete(String(f.id.id))));
  }

  private async row(id: string): Promise<FileRow | undefined> {
    const [rows] = await this.db.query<[FileRow[]]>("SELECT mime, size, installation FROM $f;", { f: fileRecord(id) });
    return rows[0];
  }

  private sign(id: string, exp: number) {
    return createHmac("sha256", this.secret).update(`${id}.${exp}`).digest("base64url");
  }
}
