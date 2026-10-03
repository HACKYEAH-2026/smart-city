import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Magazyn bajtów plików. Wymienny: dysk (dev/test), później R2/S3 (produkcja). */
export interface FileStore {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9_-]+$/i;

export class DiskFileStore implements FileStore {
  constructor(private readonly dir: string) {}

  private path(key: string) {
    if (!SAFE_KEY.test(key)) throw new Error(`Invalid file key: ${key}`);
    return join(this.dir, key);
  }

  async put(key: string, data: Uint8Array) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.path(key), data);
  }

  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.path(key)));
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
}

export const defaultFilesDir = () => join(tmpdir(), "twoje-miejsce-files");
