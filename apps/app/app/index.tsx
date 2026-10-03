import { Redirect } from "expo-router";
import { Platform } from "react-native";
import Landing from "../src/screens/Landing";

/** Web: landing (SEO). Aplikacja natywna startuje od razu od ekranu aplikacji. */
export default function Index() {
  if (Platform.OS !== "web") return <Redirect href="/app" />;
  return <Landing />;
}
