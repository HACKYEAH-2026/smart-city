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

/**
 * Files uploaded by the app for this plugin. Store a FileId in a `t.ref("file")` column: writing the reference
 * confirms the upload; unreferenced uploads are deleted after 24 h.
 */
export interface Files {
  info(id: FileId): Promise<FileInfo>;
  remove(id: FileId): Promise<void>;
}
