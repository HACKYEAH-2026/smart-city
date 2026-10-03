#!/usr/bin/env bash
# Podpisane archiwum iOS (tylko CI, z sekretami, po `expo prebuild --platform ios`).
# Wejście: P12, P12_PASSWORD, PROFILE, TEAM_ID, EXPO_PUBLIC_API_URL. Bundle id = ios.bundleIdentifier z app.config.ts.
set -euo pipefail
kc="$RUNNER_TEMP/signing.keychain-db"; kcpass="$(uuidgen)"
security create-keychain -p "$kcpass" "$kc"
security set-keychain-settings -lut 21600 "$kc"
security unlock-keychain -p "$kcpass" "$kc"
echo "$P12" | base64 -d > "$RUNNER_TEMP/cert.p12"
security import "$RUNNER_TEMP/cert.p12" -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k "$kc"
security set-key-partition-list -S apple-tool:,apple: -k "$kcpass" "$kc" >/dev/null
security list-keychains -d user -s "$kc" $(security list-keychains -d user | tr -d '"')

echo "$PROFILE" | base64 -d > "$RUNNER_TEMP/profile.mobileprovision"
uuid=$(security cms -D -i "$RUNNER_TEMP/profile.mobileprovision" | plutil -extract UUID raw -)
mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
cp "$RUNNER_TEMP/profile.mobileprovision" ~/Library/MobileDevice/Provisioning\ Profiles/"$uuid".mobileprovision

cat > "$RUNNER_TEMP/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>manual</string>
  <key>provisioningProfiles</key><dict><key>com.example.notebook</key><string>$uuid</string></dict>
</dict></plist>
PLIST

xcodebuild -workspace apps/app/ios/Notebook.xcworkspace -scheme Notebook -configuration Release \
  -archivePath build/ios/App.xcarchive -destination 'generic/platform=iOS' \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Manual PROVISIONING_PROFILE="$uuid" archive | tail -n 30
xcodebuild -exportArchive -archivePath build/ios/App.xcarchive \
  -exportOptionsPlist "$RUNNER_TEMP/ExportOptions.plist" -exportPath build/ios-export | tail -n 10