import { Redirect } from "expo-router";

/** Start: aplikacja (bez sesji strażnik /app przekierowuje do logowania). */
export default function Index() {
  return <Redirect href="/app" />;
}
