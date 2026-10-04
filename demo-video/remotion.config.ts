import path from "node:path";
import { webpack } from "@remotion/bundler";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.ts");

/**
 * The video renders the app's real UI (apps/app/src/components, theme) the way Expo does on the web:
 * react-native → react-native-web, `.web.*` files first. Expo Router needs a navigator, so its `Link` is stubbed.
 * React Native libraries import ESM files without extensions, which webpack must allow.
 * expo-font's web build reads `node:async_hooks` (server rendering only); the browser bundle gets an empty module.
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
    fallback: { ...config.resolve?.fallback, async_hooks: false },
    extensions: [".web.tsx", ".web.ts", ".web.js", ...(config.resolve?.extensions ?? [])],
  },
  module: {
    ...config.module,
    // React Native libraries ship ESM with extensionless imports (e.g. @gorhom/bottom-sheet), as Metro allows.
    rules: [...(config.module?.rules ?? []), { test: /\.m?js$/, resolve: { fullySpecified: false } }],
  },
  plugins: [
    ...(config.plugins ?? []),
    new webpack.NormalModuleReplacementPlugin(/^node:async_hooks$/, (r) => {
      r.request = "async_hooks";
    }),
    new webpack.DefinePlugin({ __DEV__: "false", "process.env.EXPO_OS": JSON.stringify("web") }),
  ],
}));
