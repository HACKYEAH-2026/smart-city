import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Trwały magazyn klucz-wartość. Natywnie: Keychain/Keystore (expo-secure-store),
 * web: localStorage. Jedyne miejsce z rozgałęzieniem po platformie dla danych trwałych.
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
