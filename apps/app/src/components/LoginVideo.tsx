import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors, sizes } from "../theme";

/**
 * The clip behind the login screen: full width, 1:1, muted and looping, fading into the screen at its lower edge. With reduced motion
 * the first frame stays still. Pure decoration: no accessible content.
 */
export function LoginVideo() {
  const reduced = useReducedMotion();
  const player = useVideoPlayer(require("../../assets/login-loop.mp4"), (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    if (reduced) player.pause();
    else player.play();
  }, [reduced, player]);
  return (
    <View pointerEvents="none" style={styles.frame}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Svg style={styles.fade} width="100%" height={sizes.authVideoFade}>
        <Defs>
          <LinearGradient id="loginFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginFade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // The clip is square (720 × 720): the frame is the full width, 1:1.
  frame: { width: "100%", aspectRatio: 1, overflow: "hidden" },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
