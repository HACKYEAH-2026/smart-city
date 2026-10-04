import { z } from "zod";

/** Id of a file uploaded by the app (POST …/files). A plugin never sees the bytes or the disk. */
export type FileId = string & { readonly __brand: "FileId" };
export const FILE_ID = /^file_[0-9a-f-]{36}$/;
export const fileRef = () =>
  z
    .string()
    .regex(FILE_ID, "Invalid file id")
    .transform((v) => v as FileId);

/**
 * `uploadedBy`: the id of the user who uploaded it (`null` for a file without one). `kept`: a row of the plugin references it
 * (a pending upload is still the uploader's alone). A plugin attaching a photo the user just picked checks that
 * `uploadedBy` is the user: the engine lets any row reference a kept file, e.g. a photo of someone else's report.
 */
export type FileInfo = { mime: string; size: number; uploadedBy: string | null; kept: boolean };

/**
 * Files uploaded by the app for this plugin. Store a FileId in a `t.ref("file")` column: writing the reference
 * confirms the upload; unreferenced uploads are deleted after 24 h.
 */
export interface Files {
  info(id: FileId): Promise<FileInfo>;
  remove(id: FileId): Promise<void>;
}
