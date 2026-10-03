import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { Flashlight, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AppState, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Button, IconButton, ScannerFrame, Text } from "../components";
import { scanWindowPath } from "../lib/scanWindow";
import { hasAppSettings, openAppSettings } from "../lib/settings";
import { t } from "../texts";
import { colors, layout, opacity, sizes, spacing } from "../theme";

/** The camera permission as expo-camera reports it. */
type CameraPermission = Awaited<ReturnType<typeof Camera.getCameraPermissionsAsync>>;

/**
 * Scanning a place's QR code (design E-DolaczQR): the camera fills the screen, the area outside the scanner frame
 * is dimmed, and a torch and a way back sit over it. The result of a scan is not handled yet.
 */
export default function ScanQr() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<CameraPermission | null>(null);
  const [torch, setTorch] = useState(false);
  const status = permission?.status;
  const canAskAgain = permission?.canAskAgain ?? false;
  const granted = status === "granted";

  // The permission is read again whenever the app comes back to the front, e.g. from the system settings.
  useEffect(() => {
    const sync = () => {
      Camera.getCameraPermissionsAsync().then(setPermission);
    };
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => subscription.remove();
  }, []);

  // Ask while the system still asks ("don't ask again" ends it); every visit to the screen asks again.
  useEffect(() => {
    if (status && status !== "granted" && canAskAgain) {
      Camera.requestCameraPermissionsAsync().then(setPermission);
    }
  }, [status, canAskAgain]);

  return (
    <View style={styles.root}>
      <Head>
        <title>{t.scan_title}</title>
      </Head>
      {granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
      ) : null}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Dimmer />
      </View>
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.center]}>
        <ScannerFrame>{granted || !status ? null : <Prompt canAskAgain={canAskAgain} />}</ScannerFrame>
      </View>

      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          styles.layer,
          {
            paddingTop: insets.top + layout.screenTopOffset,
            paddingBottom: insets.bottom + layout.screenBottomPadding,
          },
        ]}
      >
        <View style={styles.top}>
          <IconButton
            variant="roundOnDark"
            icon={X}
            label={t.close}
            onPress={() => router.replace("/app/join-place")}
          />
          <Text variant="labelL" color="scannerText">
            {t.scan_title}
          </Text>
          <IconButton
            variant="roundOnDark"
            icon={Flashlight}
            label={t.scan_torch}
            onPress={() => setTorch((on) => !on)}
          />
        </View>

        <View style={styles.bottom}>
          <Text variant="bodyL" color="scannerText" style={styles.hint}>
            {t.scan_hint}
          </Text>
          <Button label={t.scan_enter_code} variant="ghostOnDark" disabled />
        </View>
      </View>
    </View>
  );
}

/** Dims everything outside the scanner frame; the rounded window in the middle stays clear. */
function Dimmer() {
  const { width, height } = useWindowDimensions();
  return (
    <Svg width={width} height={height}>
      <Path
        d={scanWindowPath(width, height, sizes.scannerFrame, sizes.scannerRadius)}
        fill={colors.scannerBg}
        fillOpacity={opacity.scrim}
        fillRule="evenodd"
      />
    </Svg>
  );
}

/**
 * Shown inside the frame while the camera is not allowed: a button to ask for it while the system still asks,
 * or else the reason, with a way to the system settings where the user turns the camera on by hand.
 */
function Prompt({ canAskAgain }: { canAskAgain: boolean }) {
  if (canAskAgain) {
    return (
      <View style={styles.prompt}>
        <Button
          label={t.scan_permission_allow}
          variant="onDark"
          fullWidth={false}
          style={styles.action}
          onPress={() => {
            Camera.requestCameraPermissionsAsync();
          }}
        />
      </View>
    );
  }
  return (
    <View style={styles.prompt}>
      <Text variant="bodyL" color="scannerText" style={styles.hint}>
        {t.scan_permission_denied}
      </Text>
      {hasAppSettings ? (
        <Button
          label={t.scan_permission_settings}
          variant="onDark"
          fullWidth={false}
          style={styles.action}
          onPress={() => {
            openAppSettings();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.scannerBg },
  center: { alignItems: "center", justifyContent: "center" },
  layer: { justifyContent: "space-between", paddingHorizontal: layout.screenPaddingX },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bottom: { gap: spacing[11], alignItems: "center" },
  hint: { maxWidth: sizes.scannerHint, textAlign: "center" },
  prompt: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[8], padding: spacing[9] },
  action: { alignSelf: "center" },
});
