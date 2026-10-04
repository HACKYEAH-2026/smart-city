import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Easing, Img, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { LOGIN_MEDIA } from "./media";

/** Veo clips run at 24 fps; the loop keeps their frames. */
export const FPS = 24;
/** The login screen shows the loop as a square. */
export const SIZE = 720;
/** Seconds of the fade into a shot, unless the shot sets its own. */
const FADE = 0.8;
/** A still shot slowly pushes in by this much over its length, like a drone flying on. */
const PUSH = 0.12;

/**
 * One shot of the loop: `seconds` on screen of a clip from its second `from`, played at `rate`, or of a still that
 * slowly pushes in. `focus` moves the square crop across the 16:9 picture (CSS object-position). `fade`: seconds of
 * the dissolve into this shot (the first shot's fade closes the loop).
 */
type Shot = {
  media: keyof typeof LOGIN_MEDIA;
  seconds: number;
  from?: number;
  rate?: number;
  focus?: string;
  fade?: number;
};

/** The school shot is shared: Veo makes no clip from a still of a younger teenager (photorealistic children). */
export const VARIANTS = {
  a: [
    { media: "a-miasto-lot", from: 0.3, seconds: 4.6 },
    { media: "a-dlonie-uscisk", from: 0.3, seconds: 4.4 },
    { media: "c-szkola-qr", seconds: 4.6, fade: 0.5 },
  ],
  b: [
    { media: "b-miasto", seconds: 4.2 },
    { media: "b-dlonie-uscisk", seconds: 4.8 },
    { media: "c-szkola-qr", seconds: 4.6, fade: 0.5 },
  ],
  // The dive ends in a blur at 3.9 s (Veo cuts to another scene at 4 s): a short dissolve lands it in the handshake.
  c: [
    { media: "c-miasto-zjazd", seconds: 3.9 },
    { media: "c-dlonie-uscisk", seconds: 4, fade: 0.35 },
    { media: "c-szkola-qr", seconds: 4.6, fade: 0.5 },
  ],
} satisfies Record<string, Shot[]>;

export type Variant = keyof typeof VARIANTS;

const frames = (seconds: number) => Math.round(seconds * FPS);

const cover = (shot: Shot) =>
  ({ width: "100%", height: "100%", objectFit: "cover", objectPosition: shot.focus ?? "50% 50%" }) as const;

/** A shot `skip` seconds in (the first shot plays in two parts, see timeline). */
const ShotMedia = ({ shot, skip }: { shot: Shot; skip: number }) => {
  const frame = useCurrentFrame();
  const { kind, file } = LOGIN_MEDIA[shot.media];
  const scale = 1 + (PUSH * (frames(skip) + frame)) / frames(shot.seconds);
  return kind === "image" ? (
    <Img src={staticFile(file)} style={{ ...cover(shot), transform: `scale(${scale})` }} />
  ) : (
    <OffthreadVideo
      src={staticFile(file)}
      trimBefore={frames((shot.from ?? 0) + skip * (shot.rate ?? 1))}
      playbackRate={shot.rate ?? 1}
      muted
      style={cover(shot)}
    />
  );
};

/**
 * The loop: the shots with fades between them, and a last fade back into the opening of the first shot, so the
 * last frame runs on into the first one when the player starts over. The first shot starts a fade's length in;
 * that opening plays at the very end, under the last fade.
 */
const timeline = (shots: Shot[]) => {
  const [first, ...rest] = shots;
  if (!first) throw new Error("A login loop needs at least one shot");
  const closing = frames(first.fade ?? FADE);
  return [
    { key: `${first.media}-rest`, shot: first, skip: closing / FPS, length: frames(first.seconds) - closing, fade: 0 },
    ...rest.map((shot) => ({
      key: shot.media,
      shot,
      skip: 0,
      length: frames(shot.seconds),
      fade: frames(shot.fade ?? FADE),
    })),
    { key: `${first.media}-opening`, shot: first, skip: 0, length: closing, fade: closing },
  ];
};

export const loopFrames = (variant: Variant) =>
  timeline(VARIANTS[variant]).reduce((sum, part) => sum + part.length - part.fade, 0);

export const LoginLoop = ({ variant }: { variant: Variant }) => (
  <TransitionSeries>
    {timeline(VARIANTS[variant]).flatMap(({ key, shot, skip, length, fade: fadeFrames }) => [
      ...(fadeFrames > 0
        ? [
            <TransitionSeries.Transition
              key={`fade-${key}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: fadeFrames, easing: Easing.inOut(Easing.ease) })}
            />,
          ]
        : []),
      <TransitionSeries.Sequence key={key} durationInFrames={length}>
        <ShotMedia shot={shot} skip={skip} />
      </TransitionSeries.Sequence>,
    ])}
  </TransitionSeries>
);
