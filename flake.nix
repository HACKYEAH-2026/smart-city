{
  description = "Twoje Miejsce: Bun + Hono + SurrealDB + Expo (React Native, web)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    { flake-parts, nixpkgs, ... }@inputs:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      perSystem =
        { system, ... }:
        let
          pkgs = import nixpkgs {
            inherit system;
            config = {
              allowUnfree = true;
              android_sdk.accept_license = true;
            };
          };

          # Versions MUST match React Native (node_modules/react-native/gradle/libs.versions.toml):
          # compileSdk 36, buildTools 36.0.0, NDK 27.1.12297006. The nix SDK is read-only,
          # so Gradle cannot install missing components — missing = build error.
          android = pkgs.androidenv.composeAndroidPackages {
            platformVersions = [ "36" ];
            buildToolsVersions = [
              "35.0.0"
              "36.0.0"
            ];
            includeNDK = true;
            ndkVersions = [ "27.1.12297006" ];
            cmakeVersions = [ "3.22.1" ];
            includeEmulator = false;
            includeSystemImages = false;
          };
          androidSdk = android.androidsdk;
          sdkRoot = "${androidSdk}/libexec/android-sdk";

          # Biome, Playwright, Expo CLI are in bun.lock — not duplicated here.
          base = with pkgs; [
            bun
            nodejs_24 # Expo CLI / Metro / Gradle autolinking run on Node
            gh
            just # justfile: shortcuts for the package.json scripts
            mprocs # `just dev`: API + Expo in one terminal (mprocs.yaml)
          ];

          # Linux: nix's bun loads native addons with nix's loader, which never looks in /usr/lib, so the prebuilt
          # @surrealdb/node binary cannot find libstdc++.so.6 / libgcc_s.so.1 ("Cannot find native binding" in CI).
          nativeLibs = pkgs.lib.optionalAttrs pkgs.stdenv.isLinux {
            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ];
          };

          # mkShellNoCC: does not override DEVELOPER_DIR/SDKROOT on macOS (xcodebuild, CocoaPods).
          mkShell = packages: extra: pkgs.mkShellNoCC ({ inherit packages; } // nativeLibs // extra);
        in
        {
          # Default: everything for dev, tests and web (fast, no Android SDK).
          devShells.default = mkShell base { };

          # The Android build (`bun run android`): nix develop .#android
          devShells.android = mkShell (base ++ [ pkgs.jdk17 androidSdk ]) {
            JAVA_HOME = pkgs.jdk17.home;
            ANDROID_HOME = sdkRoot;
            ANDROID_SDK_ROOT = sdkRoot;
            ANDROID_NDK_HOME = "${sdkRoot}/ndk/27.1.12297006";
            GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${sdkRoot}/build-tools/36.0.0/aapt2";
          };

          formatter = pkgs.nixfmt;
        };
    };
}
