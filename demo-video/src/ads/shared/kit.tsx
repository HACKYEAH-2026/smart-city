import { type CSSProperties, createContext, type ReactNode, useContext } from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../../app-ui";
import { type Scene, wordKey } from "./timing";

/** The app's typeface (loaded by ../app-ui under the families the tokens use). */
export const FONT = {
  regular: "SchibstedGrotesk_400Regular",
  medium: "SchibstedGrotesk_500Medium",
  semibold: "SchibstedGrotesk_600SemiBold",
  bold: "SchibstedGrotesk_700Bold",
};

const SceneContext = createContext<Scene | null>(null);
export const SceneProvider = SceneContext.Provider;

export const useScene = () => {
  const scene = useContext(SceneContext);
  if (!scene) throw new Error("useScene outside a scene");
  return scene;
};

/** Frame (in the scene) where the narrator starts `word`; `nth` picks a later occurrence. */
export const useCue = (word: string, nth = 0) => {
  const scene = useScene();
  const hit = scene.words.filter((w) => w.key === wordKey(word))[nth];
  if (!hit) throw new Error(`Cue "${word}" is not in the "${scene.id}" narration: ${scene.text}`);
  return hit.from;
};

const OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** 0 → 1 between two frames, eased out; clamped outside. */
export const ramp = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });

/** A spring 0 → 1 starting at `at`. */
export const useSpring = (at: number, damping = 18, mass = 0.8) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, mass, stiffness: 140 } });
};

const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** The value at `frame` along keyframes [[frame, value], …] (frames increasing), eased between them, held outside. */
export const keys = (frame: number, points: [number, number][]) =>
  interpolate(
    frame,
    points.map(([f]) => f),
    points.map(([, v]) => v),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: IN_OUT },
  );

/** A short camera shake from `at`: a decaying jitter in pixels. */
export const shake = (frame: number, at: number, frames = 12, amplitude = 14) => {
  const t = frame - at;
  if (t < 0 || t > frames) return { x: 0, y: 0 };
  const decay = 1 - t / frames;
  return { x: Math.sin(t * 2.7) * amplitude * decay, y: Math.cos(t * 3.4) * amplitude * decay * 0.6 };
};

/** Fade and rise in from below (CSS). */
export const rise = (p: number, distance = 28): CSSProperties => ({
  opacity: Math.min(1, p * 1.4),
  transform: `translateY(${(1 - p) * distance}px)`,
});

/** Land quickly: a fade and a short rise, no zoom (CSS). */
export const snap = (p: number): CSSProperties => ({
  opacity: Math.min(1, p * 1.6),
  transform: `translateY(${(1 - p) * 14}px)`,
});

/** Text typed from `at` at `perFrame` characters a frame. */
export const typed = (text: string, frame: number, at: number, perFrame = 0.9) =>
  text.slice(0, Math.max(0, Math.floor((frame - at) * perFrame)));

/** Uppercase eyebrow over a headline. */
export const Eyebrow = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      fontFamily: FONT.semibold,
      fontSize: 24,
      letterSpacing: 2.4,
      textTransform: "uppercase",
      color: colors.primary,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * When the narrator says each of `words` in the current scene: matched in order, so the headline can repeat the
 * narration; a word the narrator does not say comes `stagger` frames after the one before it.
 */
const useSpokenFrames = (words: string[], at: number, stagger: number) => {
  const scene = useScene();
  return words.reduce<{ frames: number[]; next: number }>(
    ({ frames, next }, word) => {
      const index = scene.words.findIndex((w, i) => i >= next && w.key === wordKey(word) && w.from >= at);
      const hit = scene.words[index];
      const frame = hit ? hit.from : (frames.at(-1) ?? at - stagger) + stagger;
      return { frames: [...frames, frame], next: hit ? index + 1 : next };
    },
    { frames: [], next: 0 },
  ).frames;
};

/**
 * A headline whose words rise one after another from `at` (every `stagger` frames), or, with `spoken`, each as
 * the narrator says it. Words listed in `accent` are red. `\n` in the text breaks the line.
 */
export const Headline = ({
  text,
  at,
  stagger = 3,
  spoken = false,
  variant = "rise",
  size = 88,
  accent = [],
  align = "left",
  style,
}: {
  text: string;
  at: number;
  stagger?: number;
  spoken?: boolean;
  /** rise: each word rises into place; snap: each word lands quickly, a fade and a short rise. */
  variant?: "rise" | "snap";
  size?: number;
  accent?: string[];
  align?: "left" | "center";
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const lines = text.split("\n").map((line) => line.split(" ").filter(Boolean));
  const accents = new Set(accent.map(wordKey));
  const spokenAt = useSpokenFrames(lines.flat(), at, stagger);
  const startOf = (index: number) => (spoken ? (spokenAt[index] ?? at) : at + index * stagger);
  return (
    <div
      style={{
        fontFamily: FONT.bold,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: -size * 0.03,
        color: colors.text,
        textAlign: align,
        ...style,
      }}
    >
      {lines.map((words, li) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed text; its lines never move.
        <div key={li} style={{ whiteSpace: "nowrap" }}>
          {words.map((word, wi) => {
            const index = lines.slice(0, li).reduce((n, l) => n + l.length, 0) + wi;
            const p =
              variant === "snap"
                ? ramp(frame, startOf(index) - 1, startOf(index) + 6)
                : ramp(frame, startOf(index) - 2, startOf(index) + 14);
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed text; a word may repeat in it.
                key={wi}
                style={{
                  display: "inline-block",
                  marginRight: "0.24em",
                  color: accents.has(wordKey(word)) ? colors.primary : undefined,
                  ...(variant === "snap" ? snap(p) : rise(p, size * 0.4)),
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/**
 * Draft subtitles of the narration, karaoke-style: the sentence being read, words already said in ink.
 * They stand in for the voice-over while there is none; the final cut renders without them.
 */
export const Captions = () => {
  const frame = useCurrentFrame();
  const scene = useScene();
  const current = [...scene.words].reverse().find((w) => w.from <= frame) ?? scene.words[0];
  const sentences = scene.words.reduce<(typeof scene.words)[]>(
    (all, w) => {
      const last = all.at(-1) ?? [];
      const ends = /[.:]$/.test(last.at(-1)?.text ?? "") || last.length >= 12;
      if (ends) all.push([w]);
      else last.push(w);
      return all;
    },
    [[]],
  );
  const sentence = sentences.find((s) => current && s.includes(current)) ?? [];
  const visible =
    ramp(frame, scene.voFrom - 6, scene.voFrom + 4) * (1 - ramp(frame, scene.duration - 10, scene.duration));
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 40,
        display: "flex",
        justifyContent: "center",
        opacity: visible,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          padding: "14px 28px",
          borderRadius: 18,
          background: "rgba(27,27,31,0.82)",
          fontFamily: FONT.medium,
          fontSize: 32,
          lineHeight: 1.3,
          textAlign: "center",
        }}
      >
        {sentence.map((w) => (
          <span key={`${w.from}-${w.text}`} style={{ color: w.from <= frame ? "#FFFFFF" : "rgba(255,255,255,0.45)" }}>
            {`${w.text} `}
          </span>
        ))}
      </div>
    </div>
  );
};

/** A finger tap on the phone screen at (x, y) in screen points: a dot that lands and a ripple. */
export const Tap = ({ x, y, at }: { x: number; y: number; at: number }) => {
  const frame = useCurrentFrame();
  const land = ramp(frame, at - 8, at);
  const lift = ramp(frame, at + 4, at + 14);
  const ripple = ramp(frame, at, at + 18);
  if (frame < at - 8 || frame > at + 20) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none", zIndex: 50 }}>
      <div
        style={{
          position: "absolute",
          width: 120,
          height: 120,
          left: -60,
          top: -60,
          borderRadius: 60,
          border: `3px solid ${colors.primary}`,
          opacity: (1 - ripple) * 0.6,
          transform: `scale(${0.3 + ripple * 0.7})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 44,
          height: 44,
          left: -22,
          top: -22,
          borderRadius: 22,
          background: "rgba(27,27,31,0.28)",
          border: "2px solid rgba(255,255,255,0.9)",
          opacity: land * (1 - lift),
          transform: `scale(${1.4 - land * 0.4})`,
        }}
      />
    </div>
  );
};

/** A colour that grows as a circle from (x, y) over the whole frame, from `at` for `frames`. */
export const Wipe = ({
  at,
  frames = 14,
  color,
  x = 960,
  y = 540,
  children,
}: {
  at: number;
  frames?: number;
  color: string;
  x?: number;
  y?: number;
  children?: ReactNode;
}) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + frames);
  if (frame < at) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: color,
        clipPath: `circle(${p * 2300}px at ${x}px ${y}px)`,
      }}
    >
      {children}
    </div>
  );
};

/** A spinner turned by the frame (the app's ActivityIndicator spins on the clock, which a render does not keep). */
export const Spinner = ({ size = 22 }: { size?: number }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        border: `3px solid ${colors.primaryTint}`,
        borderTopColor: colors.primary,
        transform: `rotate(${frame * 18}deg)`,
      }}
    />
  );
};
