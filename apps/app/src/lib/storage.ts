import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Persistent key-value store. Native: Keychain/Keystore (expo-secure-store),
 * web: localStorage. The only platform branch for persistent data.
 */
export type Storage = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

const web: Storage = {
  get: async (k) => (typeof localStorage === "undefined" ? null : localStorage.getItem(k)),
  set: async (k, v) => localStorage.setItem(k, v),
  remove: async (k) => localStorage.removeItem(k),
};

const native: Storage = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) => SecureStore.setItemAsync(k, v),
  remove: (k) => SecureStore.deleteItemAsync(k),
};

export const storage: Storage = Platform.OS === "web" ? web : native;
