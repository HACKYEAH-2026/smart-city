import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import { tokens } from "./api";
import { apiBaseUrl } from "./config";

/**
 * Photo upload for a plugin (multipart). The only manual fetch in the app: the RPC client (hc) has no
 * types for multipart without a validator, and the photo is a Blob on every platform (web: the picked File).
 */
export async function uploadPluginImage(slug: string, pluginId: string, asset: ImagePickerAsset): Promise<string> {
  const form = new FormData();
  // A Blob works in FormData on web and native alike (native FormData rejects a { uri } descriptor).
  const blob = Platform.OS === "web" && asset.file ? asset.file : await (await fetch(asset.uri)).blob();
  form.append("file", blob, asset.fileName ?? "photo.jpg");
  const url = `${apiBaseUrl()}/api/communities/${encodeURIComponent(slug)}/plugins/${encodeURIComponent(pluginId)}/files`;
  const res = await fetch(url, { method: "POST", headers: tokens.headers(), body: form });
  if (res.status !== 201) throw new Error(`upload ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { fileId: string }).fileId;
}
