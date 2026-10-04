import { File as DeviceFile } from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import { tokens } from "./api";
import { apiBaseUrl } from "./config";

/**
 * Photo upload for a plugin (multipart). The only manual fetch in the app: the RPC client (hc) has no
 * types for multipart without a validator.
 */
export async function uploadPluginImage(slug: string, pluginId: string, asset: ImagePickerAsset): Promise<string> {
  const form = new FormData();
  form.append("file", await photoOf(asset), asset.fileName ?? "photo.jpg");
  const url = `${apiBaseUrl()}/api/communities/${encodeURIComponent(slug)}/plugins/${encodeURIComponent(pluginId)}/files`;
  const res = await fetch(url, { method: "POST", headers: tokens.headers(), body: form });
  if (res.status !== 201) throw new Error(`upload ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { fileId: string }).fileId;
}

/**
 * The picked photo as a form part. Web: the picked File (or a Blob of its URL). Native: the file on the device, which
 * expo/fetch reads straight from disk (its name and MIME type go into the part). Not `fetch(uri).blob()`: there it is
 * React Native's Blob, copied through base64 on the way in and out (slow for a photo, and a warning in dev); native
 * FormData also rejects a `{ uri }` descriptor.
 */
async function photoOf(asset: ImagePickerAsset): Promise<Blob> {
  // DeviceFile implements Blob (expo/fetch reads its bytes()), but its typings miss a member of the app's global Blob.
  if (Platform.OS !== "web") return new DeviceFile(asset.uri) as unknown as Blob;
  return asset.file ?? (await (await fetch(asset.uri)).blob());
}
