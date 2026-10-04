import type { CSSProperties, ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomTabBar, colors, layout } from "../../app-ui";
import { FONT } from "./kit";

/** The phone the app runs in: an iPhone-sized screen in points (the app's design is 390 wide). */
export const SCREEN = { width: 390, height: 844, top: 54, bottom: 34 };
const BEZEL = 13;

const metrics = {
  frame: { x: 0, y: 0, width: SCREEN.width, height: SCREEN.height },
  insets: { top: SCREEN.top, bottom: SCREEN.bottom, left: 0, right: 0 },
};

/** Status bar with the time, signal and battery; light on dark screens (the QR scanner). */
const StatusBar = ({ dark }: { dark: boolean }) => {
  const ink = dark ? "#FFFFFF" : colors.text;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: SCREEN.top,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 34px 0 46px",
        fontFamily: FONT.semibold,
        fontSize: 17,
        color: ink,
        zIndex: 40,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <svg width="19" height="12" viewBox="0 0 19 12" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 5} y={9 - i * 3} width="3.4" height={3 + i * 3} rx="1" fill={ink} />
          ))}
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden>
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke={ink} opacity="0.4" />
          <rect x="2.5" y="2.5" width="17" height="8" rx="2" fill={ink} />
          <rect x="25" y="4.5" width="1.6" height="4" rx="0.8" fill={ink} opacity="0.4" />
        </svg>
      </span>
    </div>
  );
};

/**
 * A phone with the app's screen inside: device frame, status bar, the home indicator and the safe-area insets
 * the app's components read. `scale` sizes the whole device on the canvas.
 */
export const Phone = ({
  children,
  dark = false,
  scale = 1,
  style,
}: {
  children: ReactNode;
  dark?: boolean;
  scale?: number;
  style?: CSSProperties;
}) => (
  <div
    style={{
      width: SCREEN.width + BEZEL * 2,
      height: SCREEN.height + BEZEL * 2,
      padding: BEZEL,
      borderRadius: 68,
      background: "#141416",
      boxShadow: "0 0 0 2px #2A2A2E, 0 60px 120px -30px rgba(27,27,31,0.45), 0 30px 60px -30px rgba(27,27,31,0.35)",
      transform: `scale(${scale})`,
      transformOrigin: "center",
      ...style,
    }}
  >
    <div
      style={{
        position: "relative",
        width: SCREEN.width,
        height: SCREEN.height,
        borderRadius: 55,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: dark ? colors.scannerBg : colors.background,
      }}
    >
      <SafeAreaProvider initialMetrics={metrics} style={{ flex: 1 }}>
        {children}
      </SafeAreaProvider>
      {dark ? null : (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: SCREEN.top + 6,
            background: `linear-gradient(${colors.background} 80%, transparent)`,
            zIndex: 39,
          }}
        />
      )}
      <StatusBar dark={dark} />
      <div
        style={{
          position: "absolute",
          top: 11,
          left: (SCREEN.width - 124) / 2,
          width: 124,
          height: 36,
          borderRadius: 18,
          background: "#000",
          zIndex: 41,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: (SCREEN.width - 134) / 2,
          width: 134,
          height: 5,
          borderRadius: 3,
          background: dark ? "#FFFFFF" : colors.text,
          opacity: 0.85,
          zIndex: 41,
        }}
      />
    </div>
  </div>
);

/**
 * The app's screen shell (components/Screen) without its scroll view: background, an optional backdrop, content
 * padded by the insets, the bottom tab bar, and an `overlay` over everything (floating buttons, a sheet). `scroll`
 * moves the content up by that many points.
 */
export const AppScreen = ({
  children,
  backdrop,
  overlay,
  tabBar = false,
  scroll = 0,
}: {
  children: ReactNode;
  backdrop?: ReactNode;
  overlay?: ReactNode;
  tabBar?: boolean;
  scroll?: number;
}) => (
  <View style={{ flex: 1, backgroundColor: colors.background, overflow: "hidden" }}>
    {backdrop ? <View style={{ position: "absolute", top: -scroll, left: 0, right: 0 }}>{backdrop}</View> : null}
    <View
      style={{
        flex: 1,
        paddingTop: SCREEN.top + layout.screenTopOffset,
        paddingBottom: tabBar ? 0 : SCREEN.bottom + layout.screenBottomPadding,
        paddingHorizontal: layout.screenPaddingX,
        gap: layout.sectionGap,
        transform: [{ translateY: -scroll }],
      }}
    >
      {children}
    </View>
    {tabBar ? <BottomTabBar /> : null}
    {overlay ? (
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        {overlay}
      </View>
    ) : null}
  </View>
);
