import type { Check } from "lucide-react-native";
import type { CSSProperties, ReactNode } from "react";
import { View } from "react-native";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import { colors, Icon } from "../../app-ui";
import { FONT, ramp, rise, useSpring } from "./kit";
import { CLIP_SECONDS, type MediaId, mediaUrl } from "./media";
import { Phone, SCREEN } from "./Phone";
import { votesText } from "./screens";

/**
 * Pieces every ad's scenes are built from: the city map backdrop, a phone placed in 3D, the app's screen pushes,
 * pills that pop in, generated stills, the big count.
 */

export const NIGHT = "#141519";
/** The margin nothing on the 1920×1080 frame comes closer than to its bottom edge (title safe, ~7%). */
export const SAFE = 72;
export const OUTER = { width: SCREEN.width + 26, height: SCREEN.height + 26 };

/* ── Stage pieces ─────────────────────────────────────────────────────────────────────────────────────── */

/** The city map behind the light scenes: streets, a river and parks in the app's map colours, drifting. */
export const CityMap = ({ drift = 0.6 }: { drift?: number }) => {
  const frame = useCurrentFrame();
  return (
    <svg
      width="2400"
      height="1400"
      viewBox="0 0 2200 1300"
      style={{ position: "absolute", left: -180 - frame * drift, top: -140, opacity: 0.8 }}
      aria-hidden
    >
      <path
        d="M-50 860 C 400 760, 700 1010, 1150 900 S 1900 760, 2300 860"
        stroke={colors.mapWater}
        strokeWidth="90"
        fill="none"
      />
      <rect x="260" y="160" width="300" height="200" rx="28" fill={colors.mapPark} />
      <rect x="1500" y="420" width="260" height="240" rx="28" fill={colors.mapPark} />
      <g stroke={colors.mapRoad} strokeWidth="26" fill="none" strokeLinecap="round">
        <path d="M0 470 L2200 420" />
        <path d="M720 -20 L790 1320" />
        <path d="M1260 -20 L1190 1320" />
        <path d="M0 120 L2200 200" />
      </g>
      <g stroke={colors.mapRoadMinor} strokeWidth="14" fill="none" strokeLinecap="round">
        <path d="M200 -20 L330 1320" />
        <path d="M1650 -20 L1820 1320" />
        <path d="M0 640 L2200 620" />
        <path d="M0 1080 L2200 1010" />
        <path d="M980 -20 L1000 1320" />
        <path d="M400 300 L1100 260" />
      </g>
    </svg>
  );
};

export const Light = ({ children, drift }: { children: ReactNode; drift?: number }) => (
  <AbsoluteFill style={{ background: colors.background, overflow: "hidden" }}>
    <CityMap drift={drift} />
    {children}
  </AbsoluteFill>
);

export type Pose = { x: number; y: number; scale?: number; rotY?: number; rotZ?: number; opacity?: number };

/** A phone placed by its centre on the 1920×1080 frame, turned in 3D. */
export const PhoneAt = ({ pose, dark, children }: { pose: Pose; dark?: boolean; children: ReactNode }) => {
  const { x, y, scale = 1, rotY = 0, rotZ = 0, opacity = 1 } = pose;
  return (
    <div
      style={{
        position: "absolute",
        left: x - OUTER.width / 2,
        top: y - OUTER.height / 2,
        opacity,
        transform: `perspective(2400px) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`,
      }}
    >
      <Phone dark={dark}>{children}</Phone>
    </div>
  );
};

/** Phone screens pushed one after another, as the app navigates: each from the right at its frame. */
export const Pushed = ({ screens }: { screens: { at: number; node: ReactNode }[] }) => {
  const frame = useCurrentFrame();
  const index = Math.max(
    0,
    screens.findLastIndex((s) => s.at <= frame),
  );
  const current = screens[index];
  const previous = screens[index - 1];
  const p = current && index > 0 ? ramp(frame, current.at, current.at + 12) : 1;
  const layer = (x: number, dim: number): CSSProperties => ({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    transform: `translateX(${x}px)`,
    filter: dim ? `brightness(${1 - dim * 0.25})` : undefined,
  });
  return (
    <>
      {previous && p < 1 ? <div style={layer(-p * SCREEN.width * 0.3, p)}>{previous.node}</div> : null}
      <div style={layer((1 - p) * SCREEN.width, 0)}>{current?.node}</div>
    </>
  );
};

/** A white flash over the phone screen (the camera's shutter, a scanned code). */
export const Flash = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const o = frame < at ? 0 : 1 - ramp(frame, at, at + 10);
  return o > 0 ? (
    <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: o, zIndex: 45 }} />
  ) : null;
};

export const Center = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...style }}>{children}</AbsoluteFill>
);

/** A pill that pops in at `at` and, with `hold`, leaves that many frames later. */
export const Pop = ({
  at,
  hold,
  children,
  style,
}: {
  at: number;
  hold?: number;
  children: ReactNode;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const p = useSpring(at, 11, 0.6);
  const out = hold === undefined ? 0 : ramp(frame, at + hold, at + hold + 8);
  if (frame < at) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 30px",
        borderRadius: 999,
        fontFamily: FONT.semibold,
        fontSize: 36,
        whiteSpace: "nowrap",
        boxShadow: "0 20px 50px rgba(27,27,31,0.18)",
        opacity: Math.min(1, p * 2) * (1 - out),
        transform: `scale(${(0.5 + p * 0.5) * (1 - out * 0.2)})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const WhiteIcon = ({
  icon,
  size = 30,
  stroke = 2.2,
}: {
  icon: typeof Check;
  size?: number;
  stroke?: number;
}) => (
  <View>
    <Icon icon={icon} size={size} color="onPrimary" strokeWidth={stroke} />
  </View>
);

/** A generated still filling the frame, with a camera move and an optional blur and dimming. */
export const Photo = ({
  src,
  scale = 1,
  blur = 0,
  dim = 0,
  opacity = 1,
}: {
  src: string;
  scale?: number;
  blur?: number;
  dim?: number;
  opacity?: number;
}) => (
  <Img
    src={src}
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      opacity,
      transform: `scale(${scale})`,
      filter: blur || dim ? `blur(${blur}px) brightness(${1 - dim})` : undefined,
    }}
  />
);

/** Darkens the left of the frame, where the opening's lines stand. */
export const LeftShade = () => (
  <AbsoluteFill
    style={{ background: "linear-gradient(to right, rgba(8,8,10,0.78) 0%, rgba(8,8,10,0.45) 45%, rgba(8,8,10,0) 75%)" }}
  />
);

/** The big count of votes under one report: it rolls up from 1 to `to`, worded like the issues plugin, with `note`. */
export const Counter = ({ at, to, note = "w jednym zgłoszeniu" }: { at: number; to: number; note?: string }) => {
  const frame = useCurrentFrame();
  const n = Math.max(1, Math.min(to, 1 + Math.round(ramp(frame, at, at + 24) * (to - 1))));
  const [count, ...words] = [...votesText(n).split(" "), note];
  const p = useSpring(at, 12);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 30, ...rise(p, 40) }}>
      <div style={{ fontFamily: FONT.bold, fontSize: 300, lineHeight: 0.9, color: colors.primary }}>{count}</div>
      <div style={{ fontFamily: FONT.bold, fontSize: 72, lineHeight: 1.05, color: colors.text }}>
        {words[0]}
        <br />
        {words.slice(1).join(" ")}
      </div>
    </div>
  );
};

/**
 * A generated clip filling its box from frame `at` until `until`, starting `from` seconds into the clip and playing
 * `span` seconds of it (by default the rest of the clip, never more than the shot needs). The clip runs slower or
 * faster to fit the shot (no frozen last frame). Without the file, a dark stand-in.
 */
export const ClipVideo = ({
  id,
  from,
  at,
  until,
  span,
}: {
  id: MediaId;
  from: number;
  at: number;
  until: number;
  span?: number;
}) => {
  const url = mediaUrl(id);
  const needed = (until - at) / 30;
  const played = span ?? Math.min(CLIP_SECONDS - from, needed);
  const rate = Math.max(0.5, Math.min(1.6, played / needed));
  return url ? (
    // Its own clock: the clip plays from `from` when the shot starts, whatever the scene's frame.
    <Sequence from={at}>
      <OffthreadVideo
        src={url}
        trimBefore={from * 30}
        playbackRate={rate}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </Sequence>
  ) : (
    <AbsoluteFill style={{ background: "#2B2C33" }} />
  );
};
