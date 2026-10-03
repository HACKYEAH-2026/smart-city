import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { isEdgeToEdge } from "react-native-is-edge-to-edge";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FlashProvider } from "../src/lib/flash";
import { colors, useAppFonts } from "../src/theme";

/**
 * The app always draws edge-to-edge (Screen pads by the safe-area insets), but Expo Go does not report it, and then
 * KeyboardProvider pads the root for an opaque status bar (a white band at the top). Builds that report it get
 * undefined: the provider is edge-to-edge anyway and warns about explicit values.
 */
const translucentBars = isEdgeToEdge() ? undefined : true;

/** Root: providers (data, safe area, keyboard) + navigation stack. The only place providers are mounted. */
export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  const [fontsLoaded] = useAppFonts();
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <KeyboardProvider statusBarTranslucent={translucentBars} navigationBarTranslucent={translucentBars}>
        <QueryClientProvider client={queryClient}>
          <FlashProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
          </FlashProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
