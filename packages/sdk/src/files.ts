import { z } from "zod";

/** Id of a file uploaded by the app (POST …/files). A plugin never sees the bytes or the disk. */
export type FileId = string & { readonly __brand: "FileId" };
export const FILE_ID = /^file_[0-9a-f-]{36}$/;
export const fileRef = () =>
  z
    .string()
    .regex(FILE_ID, "Invalid file id")
    .transform((v) => v as FileId);

export type FileInfo = { mime: string; size: number };

export interface Files {
  /** Confirms this user's upload in this plugin. Unconfirmed files disappear after 24 h. */
  keep(id: FileId): Promise<void>;
  info(id: FileId): Promise<FileInfo>;
  remove(id: FileId): Promise<void>;
}
