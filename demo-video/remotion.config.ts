import path from "node:path";
import { webpack } from "@remotion/bundler";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.ts");

/**
 * The video renders the app's real UI (apps/app/src/components/ui.tsx, theme.ts) the way Expo does on the web:
 * react-native → react-native-web, `.web.*` files first. Expo Router needs a navigator, so its `Link` is stubbed.
 */
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias as Record<string, string>),
      "react-native$": "react-native-web",
      "expo-router$": path.resolve("src/web/expo-router.tsx"),
    },
    extensions: [".web.tsx", ".web.ts", ".web.js", ...(config.resolve?.extensions ?? [])],
  },
  plugins: [
    ...(config.plugins ?? []),
    new webpack.DefinePlugin({ __DEV__: "false", "process.env.EXPO_OS": JSON.stringify("web") }),
  ],
}));
