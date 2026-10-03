import { Redirect } from "expo-router";

/** Start: the app (without a session the /app guard redirects to login). */
export default function Index() {
  return <Redirect href="/app" />;
}
