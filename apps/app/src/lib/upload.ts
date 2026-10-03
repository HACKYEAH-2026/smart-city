import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import { tokens } from "./api";
import { apiBaseUrl } from "./config";

/**
 * Photo upload for a plugin (multipart). The only manual fetch in the app: the RPC client (hc) has no
 * types for multipart without a validator, and the file field differs between web (File) and native ({ uri }).
 */
export async function uploadPluginImage(slug: string, pluginId: string, asset: ImagePickerAsset): Promise<string> {
  const form = new FormData();
  const type = asset.mimeType ?? "image/jpeg";
  if (Platform.OS === "web") {
    const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
    form.append("file", blob, asset.fileName ?? "photo.jpg");
  } else {
    // React Native: FormData accepts a descriptor of a file on the device's disk.
    form.append("file", { uri: asset.uri, name: asset.fileName ?? "photo.jpg", type } as unknown as Blob);
  }
  const url = `${apiBaseUrl()}/api/communities/${encodeURIComponent(slug)}/plugins/${encodeURIComponent(pluginId)}/files`;
  const res = await fetch(url, { method: "POST", headers: tokens.headers(), body: form });
  if (res.status !== 201) throw new Error(`upload ${res.status}`);
  return ((await res.json()) as { fileId: string }).fileId;
}
