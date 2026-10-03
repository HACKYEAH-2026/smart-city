{
  description = "Twoje Miejsce: Bun + Hono + Drizzle/SQLite + Expo (React Native, web)";

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

          # Wersje MUSZĄ zgadzać się z React Native (node_modules/react-native/gradle/libs.versions.toml):
          # compileSdk 36, buildTools 36.0.0, NDK 27.1.12297006. SDK z nixa jest tylko do odczytu,
          # więc Gradle nie doinstaluje brakujących elementów — brak = błąd builda.
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

          # Biome, Playwright, Expo CLI, wrangler są w bun.lock — nie dublujemy ich tutaj.
          base = with pkgs; [
            bun
            nodejs_24 # Expo CLI / Metro / Gradle autolinking działają na Node
            sqlite
            opentofu
            gh
            jq
          ];

          # mkShellNoCC: nie nadpisujemy DEVELOPER_DIR/SDKROOT na macOS (xcodebuild, CocoaPods).
          mkShell = packages: extra: pkgs.mkShellNoCC ({ inherit packages; } // extra);
        in
        {
          devShells.default = mkShell (base ++ [ pkgs.jdk17 androidSdk ]) {
            JAVA_HOME = pkgs.jdk17.home;
            ANDROID_HOME = sdkRoot;
            ANDROID_SDK_ROOT = sdkRoot;
            ANDROID_NDK_HOME = "${sdkRoot}/ndk/27.1.12297006";
            GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${sdkRoot}/build-tools/36.0.0/aapt2";
          };

          # Bez Androida (job iOS na macOS, job backupu w CI).
          devShells.light = mkShell base { };

          formatter = pkgs.nixfmt;
        };
    };
}
