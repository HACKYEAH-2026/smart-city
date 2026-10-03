import { t } from "@app/app/src/texts";
import { Check, GraduationCap, Home, Landmark, Sparkles } from "lucide-react-native";
import type { CSSProperties, ReactNode } from "react";
import { View } from "react-native";
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame } from "remotion";
import { BrandMark, colors, Icon } from "../app-ui";
import { MONO } from "../theme";
import { Eyebrow, FONT, Headline, keys, ramp, rise, shake, Tap, typed, useCue, useScene, useSpring, Wipe } from "./kit";
import { mediaUrl } from "./media";
import { Phone, SCREEN } from "./Phone";
import {
  announcementsListView,
  announcementsWidget,
  BuildScreen,
  type BuildStage,
  budgetView,
  budgetWidget,
  DashboardScreen,
  detailView,
  discussionsView,
  IssueCard,
  IssueFormScreen,
  issuesListView,
  issuesWidget,
  ManageScreen,
  mergeView,
  PluginScreen,
  ScannerScreen,
  type Status,
} from "./screens";

const NIGHT = "#141519";
const OUTER = { width: SCREEN.width + 26, height: SCREEN.height + 26 };
const REQUEST = "Głosowanie mieszkańców nad pomysłami z budżetu obywatelskiego, z wynikami na pulpicie.";

/* ── Stage pieces ─────────────────────────────────────────────────────────────────────────────────────── */

/** The city map behind the light scenes: streets, a river and parks in the app's map colours, drifting. */
const CityMap = ({ drift = 0.6 }: { drift?: number }) => {
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

const Light = ({ children, drift }: { children: ReactNode; drift?: number }) => (
  <AbsoluteFill style={{ background: colors.background, overflow: "hidden" }}>
    <CityMap drift={drift} />
    {children}
  </AbsoluteFill>
);

type Pose = { x: number; y: number; scale?: number; rotY?: number; rotZ?: number; opacity?: number };

/** A phone placed by its centre on the 1920×1080 frame, turned in 3D. */
const PhoneAt = ({ pose, dark, children }: { pose: Pose; dark?: boolean; children: ReactNode }) => {
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
const Pushed = ({ screens }: { screens: { at: number; node: ReactNode }[] }) => {
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
const Flash = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const o = frame < at ? 0 : 1 - ramp(frame, at, at + 10);
  return o > 0 ? (
    <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: o, zIndex: 45 }} />
  ) : null;
};

const Center = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...style }}>{children}</AbsoluteFill>
);

/** A pill that pops in at `at` and, with `hold`, leaves that many frames later. */
const Pop = ({
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

const WhiteIcon = ({ icon, size = 30, stroke = 2.2 }: { icon: typeof Check; size?: number; stroke?: number }) => (
  <View>
    <Icon icon={icon} size={size} color="onPrimary" strokeWidth={stroke} />
  </View>
);

/* ── 1 · open: three quick hits in the dark ─────────────────────────────────────────────────────────── */

const Lamp = ({ glow }: { glow: number }) => (
  <svg width="520" height="560" viewBox="0 0 520 560" aria-hidden>
    <defs>
      <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FFD58A" stopOpacity="0.9" />
        <stop offset="1" stopColor="#FFD58A" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFD58A" stopOpacity="0.5" />
        <stop offset="1" stopColor="#FFD58A" stopOpacity="0" />
      </linearGradient>
    </defs>
    <g opacity={glow}>
      <path d="M150 128 L20 560 L360 560 L230 128 Z" fill="url(#beam)" />
      <circle cx="190" cy="118" r="120" fill="url(#halo)" />
    </g>
    <rect x="356" y="96" width="16" height="464" rx="5" fill="#34353D" />
    <path
      d="M364 112 C 364 80, 330 72, 290 72 L 220 72"
      stroke="#34353D"
      strokeWidth="14"
      fill="none"
      strokeLinecap="round"
    />
    <path d="M140 96 L240 96 L226 122 L154 122 Z" fill="#34353D" />
    <rect x="156" y="120" width="68" height="10" rx="5" fill={glow > 0.5 ? "#FFE9B8" : "#44454E"} />
  </svg>
);

const Notice = ({ buried }: { buried: number }) => (
  <div
    style={{
      width: 420,
      padding: 34,
      borderRadius: 10,
      background: "#FFFDF7",
      boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
      transform: `rotate(-5deg) scale(${1 - buried * 0.35}) translateY(${buried * 260}px)`,
      filter: `blur(${buried * 8}px)`,
      opacity: 1 - buried * 0.8,
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}
  >
    <div style={{ fontFamily: FONT.bold, fontSize: 34, letterSpacing: 3, color: colors.primary }}>OGŁOSZENIE</div>
    {[1, 0.9, 0.95, 0.6].map((w) => (
      <div key={w} style={{ height: 14, width: `${w * 100}%`, borderRadius: 7, background: "#D9D5CB" }} />
    ))}
  </div>
);

/** A generated still filling the frame, with a camera move and an optional blur and dimming. */
const Photo = ({
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
const LeftShade = () => (
  <AbsoluteFill
    style={{ background: "linear-gradient(to right, rgba(8,8,10,0.78) 0%, rgba(8,8,10,0.45) 45%, rgba(8,8,10,0) 75%)" }}
  />
);

export const OpenScene = () => {
  const frame = useCurrentFrame();
  const fading = useCue("nie");
  const dark = useCue("świeci");
  const hole = useCue("dziura");
  const notice = useCue("ogłoszenie");
  const nobody = useCue("nikt");
  const flicker =
    frame < fading ? 1 : frame < dark ? ([1, 0.15, 0.85, 0.05, 0.5][Math.floor((frame - fading) / 2) % 5] ?? 0) : 0;
  const punch = (at: number) =>
    keys(frame, [
      [at, 1.14],
      [at + 9, 1],
    ]);
  const jolt = shake(frame, hole, 14, 22);
  const crack = ramp(frame, hole, hole + 16);
  const lit = mediaUrl("latarnia-on");
  const unlit = mediaUrl("latarnia");
  const pavement = mediaUrl("chodnik");
  const board = mediaUrl("ogloszenie");
  const lost = ramp(frame, nobody - 4, nobody + 16);
  return (
    <AbsoluteFill style={{ background: NIGHT, overflow: "hidden" }}>
      {frame < hole - 1 ? (
        <AbsoluteFill>
          {lit && unlit ? (
            <>
              <Photo
                src={unlit}
                scale={keys(frame, [
                  [0, 1],
                  [hole, 1.07],
                ])}
              />
              <Photo
                src={lit}
                scale={keys(frame, [
                  [0, 1],
                  [hole, 1.07],
                ])}
                opacity={flicker}
              />
              <LeftShade />
            </>
          ) : (
            <div style={{ position: "absolute", left: 120, top: 150, opacity: ramp(frame, 0, 14) }}>
              <Lamp glow={flicker} />
            </div>
          )}
          <Headline
            text={"Latarnia,\nktóra nie świeci."}
            at={0}
            spoken
            variant="slam"
            size={124}
            accent={["nie", "świeci."]}
            style={{ position: "absolute", left: lit ? 120 : 760, top: 330, color: "#FFFFFF" }}
          />
        </AbsoluteFill>
      ) : frame < notice - 1 ? (
        <AbsoluteFill
          style={{ transform: `translate(${jolt.x}px, ${jolt.y}px) scale(${punch(hole)})`, background: "#202127" }}
        >
          {pavement ? (
            <>
              <Photo
                src={pavement}
                scale={keys(frame, [
                  [hole, 1.02],
                  [notice, 1.1],
                ])}
              />
              <LeftShade />
            </>
          ) : (
            <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute" }} aria-hidden>
              <g stroke="#2E2F36" strokeWidth="6">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <path key={`h${i}`} d={`M0 ${i * 180 + 40} H1920`} />
                ))}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <path key={`v${i}`} d={`M${i * 190 + (i % 2) * 40} 0 V1080`} />
                ))}
              </g>
              <g
                stroke="#08080A"
                strokeWidth="9"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray="1800"
                strokeDashoffset={1800 * (1 - crack)}
              >
                <path d="M1180 560 L1240 610 L1228 668 L1300 720 L1290 790 L1352 846 L1340 930 L1400 1000 L1420 1090" />
                <path d="M1240 610 L1320 600 L1372 640 L1460 626" strokeWidth="6" />
                <path d="M1300 720 L1230 770 L1180 760" strokeWidth="5" />
                <path d="M1180 560 L1130 520 L1140 470 L1100 420" strokeWidth="6" />
              </g>
            </svg>
          )}
          <Headline
            text={"Dziura\nw chodniku."}
            at={hole}
            spoken
            variant="slam"
            size={170}
            style={{ position: "absolute", left: 150, top: 230, color: "#FFFFFF" }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ transform: `scale(${punch(notice)})` }}>
          {board ? (
            <>
              <Photo
                src={board}
                scale={keys(frame, [
                  [notice, 1],
                  [notice + 120, 1.12],
                ])}
                blur={lost * 10}
                dim={lost * 0.35}
              />
              <LeftShade />
            </>
          ) : (
            <div style={{ position: "absolute", left: 1220, top: 300 }}>
              <Notice buried={lost} />
            </div>
          )}
          <Headline
            text={"Ogłoszenie,\nktórego nikt\nnie zobaczył."}
            at={notice}
            spoken
            variant="slam"
            size={116}
            accent={["nikt"]}
            style={{ position: "absolute", left: 150, top: 230, color: "#FFFFFF" }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/* ── 2 · problem: a wall of posts and forms, cut by the brand's red ─────────────────────────────────── */

const NOISE = [
  ["Anonimowy uczestnik", "Już zgłaszałem, nic się nie dzieje."],
  ["Formularz", "Krok 3 z 9: wybierz właściwy wydział"],
  ["Marek", "Zaginął rudy kot, okolice parku!"],
  ["Konto bez zdjęcia", "To nic nie da."],
  ["Formularz", "Załącznik nr 2 (PDF, maks. 2 MB)"],
  ["Kasia", "Kto idzie w sobotę na mecz?"],
  ["Anonimowy uczestnik", "Sprzedam rower, prawie nowy."],
  ["Formularz", "Podaj numer ewidencyjny działki"],
  ["Ola", "Polecicie fryzjera w okolicy?"],
] as const;

const NoiseColumn = ({ offset, speed, x }: { offset: number; speed: number; x: number }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: -((frame * speed + offset) % 1400),
        width: 520,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        filter: `blur(${Math.min(6, speed * 0.25)}px)`,
      }}
    >
      {[...NOISE, ...NOISE].map(([who, text], i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: the list repeats itself on purpose.
          key={i}
          style={{
            padding: "22px 26px",
            borderRadius: 20,
            background: who === "Formularz" ? "#2B2C33" : "#E9E8E4",
            color: who === "Formularz" ? "#C8C8CC" : colors.text,
            fontFamily: FONT.regular,
            fontSize: 26,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span style={{ fontFamily: FONT.semibold, fontSize: 20, opacity: 0.6 }}>{who}</span>
          {text}
        </div>
      ))}
    </div>
  );
};

export const ProblemScene = () => {
  const { duration } = useScene();
  const groups = useCue("grupach");
  return (
    <AbsoluteFill style={{ background: NIGHT, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: "rotate(-8deg) scale(1.25)", opacity: 0.55 }}>
        <NoiseColumn x={180} offset={0} speed={14} />
        <NoiseColumn x={720} offset={600} speed={22} />
        <NoiseColumn x={1260} offset={300} speed={17} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(20,21,25,0.92) 30%, rgba(20,21,25,0.4) 75%)" }}
      />
      <Center style={{ gap: 18 }}>
        <Headline text="Lokalne sprawy giną" at={0} spoken variant="slam" size={128} style={{ color: "#FFFFFF" }} />
        <Headline
          text="w grupach i formularzach."
          at={groups - 10}
          spoken
          size={64}
          style={{ color: "#9B9BA3", fontFamily: FONT.semibold }}
        />
      </Center>
      <Wipe at={duration - 12} frames={12} color={colors.primary} />
    </AbsoluteFill>
  );
};

/* ── 3 · reveal: the brand on red, then one app for every kind of community ─────────────────────────── */

const FAN = [
  { key: "estate", place: "Osiedle Słoneczne", label: "Osiedle", icon: Home, x: 520, rot: -9, cue: "osiedla" },
  { key: "city", place: "Kraków", label: "Miasto", icon: Landmark, x: 960, rot: 0, cue: "miasta" },
  { key: "campus", place: "Kampus Główny", label: "Uczelnia", icon: GraduationCap, x: 1400, rot: 9, cue: "uczelni" },
] as const;

const FAN_WIDGETS = {
  estate: [announcementsWidget("Zebranie wspólnoty w czwartek o 18:00")],
  city: [issuesWidget(3)],
  campus: [announcementsWidget("Biblioteka otwarta do 22:00 w czasie sesji")],
};

const FanPhone = ({ item, at }: { item: (typeof FAN)[number]; at: number }) => {
  const frame = useCurrentFrame();
  const named = useCue(item.cue);
  const enter = useSpring(at, 14);
  const lift = ramp(frame, named - 2, named + 8) - ramp(frame, named + 14, named + 26);
  return (
    <>
      <PhoneAt
        pose={{
          x: item.x,
          y: 660 + (1 - enter) * 760 - lift * 34,
          scale: 0.72,
          rotZ: item.rot * enter,
          rotY: -item.rot * 0.8,
        }}
      >
        <DashboardScreen place={item.place} widgets={FAN_WIDGETS[item.key]} />
      </PhoneAt>
      <div style={{ position: "absolute", left: item.x, top: 990, transform: "translateX(-50%)" }}>
        <Pop at={named} style={{ background: "#FFFFFF", color: colors.text }}>
          <View>
            <Icon icon={item.icon} size={34} color="primary" strokeWidth={2} />
          </View>
          {item.label}
        </Pop>
      </div>
    </>
  );
};

export const RevealScene = () => {
  const frame = useCurrentFrame();
  const name = useCue("twoje");
  const one = useCue("jedna");
  const logo = useSpring(0, 12);
  const toLight = one - 8;
  return (
    <AbsoluteFill style={{ background: colors.primary, overflow: "hidden" }}>
      <Center
        style={{
          gap: 34,
          flexDirection: "row",
          transform: `scale(${keys(frame, [
            [0, 0.92],
            [toLight, 1.04],
          ])})`,
        }}
      >
        <View style={{ transform: [{ scale: 0.4 + logo * 0.6 }], opacity: Math.min(1, logo * 2) }}>
          <BrandMark size={190} color="onPrimary" />
        </View>
        <Headline text="Twoje Miejsce" at={name} spoken variant="slam" size={168} style={{ color: "#FFFFFF" }} />
      </Center>
      <Wipe at={toLight} frames={14} color={colors.background}>
        <Light drift={0.8}>
          <Headline
            text="Jedna aplikacja dla każdej społeczności."
            at={toLight + 4}
            spoken
            size={64}
            align="center"
            accent={["każdej"]}
            style={{ position: "absolute", left: 0, right: 0, top: 64 }}
          />
          {FAN.map((item, i) => (
            <FanPhone key={item.key} item={item} at={toLight + 2 + i * 4} />
          ))}
        </Light>
      </Wipe>
    </AbsoluteFill>
  );
};

/* ── 4 · join: the camera dives into the city's phone; scan, and you are in ─────────────────────────── */

export const JoinScene = () => {
  const frame = useCurrentFrame();
  const code = useCue("kod");
  const inside = useCue("jesteś");
  const lock = code + 2;
  const pose: Pose = {
    x: 960,
    y: keys(frame, [
      [0, 660],
      [12, 545],
    ]),
    scale: keys(frame, [
      [0, 0.72],
      [12, 1.04],
      [inside, 1.04],
      [inside + 14, 1],
    ]),
    rotY: keys(frame, [
      [inside, 0],
      [inside + 14, -8],
    ]),
  };
  return (
    <Light drift={1}>
      <Headline
        text={"Skanujesz\nkod"}
        at={0}
        spoken
        variant="slam"
        size={120}
        accent={["kod"]}
        style={{ position: "absolute", left: 150, top: 380 }}
      />
      <Headline
        text={"i jesteś\nw środku."}
        at={inside - 2}
        spoken
        variant="slam"
        size={120}
        style={{ position: "absolute", left: 1270, top: 380 }}
      />
      <PhoneAt pose={pose} dark={frame < inside}>
        <Pushed
          screens={[
            {
              at: 0,
              node: (
                <ScannerScreen
                  seen={ramp(frame, code - 10, code)}
                  line={frame < lock ? (Math.sin(frame / 4) + 1) / 2 : 0.5}
                />
              ),
            },
            { at: inside, node: <DashboardScreen widgets={[issuesWidget(3)]} /> },
          ]}
        />
        <Flash at={lock} />
      </PhoneAt>
    </Light>
  );
};

/* ── 5 · report: a photo, the AI's duplicate check, one issue with its count ────────────────────────── */

const Counter = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const n = Math.min(4, Math.max(1, 1 + Math.floor((frame - at) / 4)));
  const bump = frame - at < 16 && (frame - at) % 4 < 2 ? 0.06 : 0;
  const p = useSpring(at, 12);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 30, ...rise(p, 40) }}>
      <div
        style={{
          fontFamily: FONT.bold,
          fontSize: 300,
          lineHeight: 0.9,
          color: colors.primary,
          transform: `scale(${1 + bump})`,
        }}
      >
        {n}
      </div>
      <div style={{ fontFamily: FONT.bold, fontSize: 72, lineHeight: 1.05, color: colors.text }}>
        osoby
        <br />
        zgłaszają
      </div>
    </div>
  );
};

export const ReportScene = () => {
  const frame = useCurrentFrame();
  const report = useCue("zgłaszasz");
  const photo = useCue("zdjęciem");
  const ai = useCue("ai");
  const one = useCue("jedno");
  const count = useCue("ile");
  const open = 4;
  const form = 12;
  const send = ai - 10;
  const merge = ai - 2;
  const joined = one - 4;
  const scroll = keys(frame, [
    [photo - 14, 0],
    [photo - 4, 520],
  ]);
  const pose: Pose = {
    x: keys(frame, [
      [0, 960],
      [14, 620],
    ]),
    y: 545,
    rotY: keys(frame, [
      [0, -8],
      [14, 14],
    ]),
  };
  const card = useSpring(ai, 13);
  const merged = ramp(frame, one - 4, one + 10);
  return (
    <Light drift={0.7}>
      <PhoneAt pose={pose}>
        <Pushed
          screens={[
            { at: 0, node: <DashboardScreen widgets={[issuesWidget(3)]} /> },
            {
              at: form,
              node: (
                <IssueFormScreen
                  title={typed("Nie świeci latarnia", frame, form + 4, 1.2)}
                  category={frame >= report + 4 ? "Oświetlenie" : "Inne"}
                  withPhoto={frame >= photo + 2}
                  scroll={scroll}
                />
              ),
            },
            { at: merge, node: <PluginScreen node={mergeView()} /> },
            {
              at: joined + 6,
              node: (
                <PluginScreen node={detailView({ support: frame >= count ? 4 : 3, status: "open", admin: false })} />
              ),
            },
          ]}
        />
        <Tap x={195} y={516} at={open} />
        <Tap x={195} y={342} at={report + 2} />
        <Tap x={95} y={269} at={photo} />
        <Flash at={photo + 1} />
        <Tap x={195} y={598} at={send} />
        <Tap x={195} y={718} at={joined} />
      </PhoneAt>
      {frame < ai - 4 ? (
        <Headline
          text={"Problem zgłaszasz\nzdjęciem."}
          at={0}
          spoken
          variant="slam"
          size={96}
          accent={["zdjęciem."]}
          style={{ position: "absolute", left: 1010, top: 400 }}
        />
      ) : frame < count - 4 ? (
        <div style={{ position: "absolute", left: 1040, top: 110, display: "flex", flexDirection: "column", gap: 28 }}>
          <Pop at={ai} style={{ background: colors.text, color: "#FFFFFF", alignSelf: "flex-start" }}>
            <WhiteIcon icon={Sparkles} />
            AI wykrywa duplikaty
          </Pop>
          <div style={{ position: "relative", width: 560, height: 560 }}>
            {[2, 1, 0].map((layer) => (
              <div
                key={layer}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: SCREEN.width - 48,
                  transformOrigin: "top left",
                  transform: `translate(${layer * 40 * (1 - merged)}px, ${layer * 34 * (1 - merged)}px) rotate(${layer * 3 * (1 - merged)}deg) scale(1.3)`,
                  opacity: layer === 0 ? Math.min(1, card * 1.5) : (1 - merged) * 0.75 * card,
                }}
              >
                <IssueCard support={layer === 0 && frame >= one ? 4 : 1} />
              </div>
            ))}
          </div>
          <Headline text="Jedno zgłoszenie." at={one} spoken variant="slam" size={84} accent={["jedno"]} />
        </div>
      ) : (
        <div style={{ position: "absolute", left: 1040, top: 360 }}>
          <Counter at={count - 2} />
        </div>
      )}
    </Light>
  );
};

/* ── 6 · city: the city's phone and the resident's, the same status on both ─────────────────────────── */

export const CityScene = () => {
  const frame = useCurrentFrame();
  const accepted = useCue("przyjęte");
  const fixed = useCue("naprawione");
  const enter = useSpring(0, 15);
  const status: Status = frame >= fixed ? "fixed" : frame >= accepted ? "accepted" : "open";
  const glow = ramp(frame, fixed, fixed + 20);
  return (
    <Light drift={0.5}>
      <AbsoluteFill
        style={{
          background: "radial-gradient(circle at 50% 62%, rgba(255,213,138,0.8), rgba(255,213,138,0) 60%)",
          opacity: glow,
        }}
      />
      <Headline
        text="Status zmienia się na Twoich oczach."
        at={0}
        spoken
        size={68}
        align="center"
        style={{ position: "absolute", left: 0, right: 0, top: 54 }}
      />
      <PhoneAt pose={{ x: 690 - (1 - enter) * 600, y: 640, scale: 0.8, rotY: 18 }}>
        <PluginScreen node={detailView({ support: 4, status, admin: true })} />
        <Tap x={75} y={338} at={accepted - 2} />
        <Tap x={242} y={338} at={fixed - 2} />
      </PhoneAt>
      <PhoneAt pose={{ x: 1230 + (1 - enter) * 600, y: 640, scale: 0.8, rotY: -18 }}>
        <PluginScreen node={detailView({ support: 4, status, admin: false })} />
      </PhoneAt>
      <div style={{ position: "absolute", left: 690, top: 196, transform: "translateX(-50%)", opacity: enter }}>
        <Eyebrow>Urząd miasta</Eyebrow>
      </div>
      <div style={{ position: "absolute", left: 1230, top: 196, transform: "translateX(-50%)", opacity: enter }}>
        <Eyebrow>Mieszkanka</Eyebrow>
      </div>
      <div style={{ position: "absolute", left: 960, top: 640, transform: "translate(-50%, -50%)" }}>
        <Pop
          at={accepted}
          hold={fixed - accepted - 6}
          style={{ background: colors.text, color: "#FFFFFF", fontSize: 44 }}
        >
          Przyjęte
        </Pop>
      </div>
      <div style={{ position: "absolute", left: 960, top: 640, transform: "translate(-50%, -50%)" }}>
        <Pop at={fixed} style={{ background: colors.primary, color: "#FFFFFF", fontSize: 48 }}>
          <WhiteIcon icon={Check} size={42} stroke={3} />
          Naprawione
        </Pop>
      </div>
    </Light>
  );
};

/* ── 7 · builder: a missing feature, described in the app; the AI writes it, checks it, everyone gets it ─ */

const CODE = `import type { PluginModule } from "@app/plugin-sdk";

const budzet: PluginModule = ({ definePlugin, ui, z, t }) =>
  definePlugin({
    id: "budzet",
    name: "Budżet obywatelski",
    icon: "🗳️",
    permissions: ["db"],
    tables: {
      ideas: t.table({ title: t.text(), votes: t.integer().default(0) }),
      votes: t.table(
        { idea: t.ref("ideas"), voter: t.ref("user") },
        { unique: [["idea", "voter"]] },
      ),
    },
    views: {
      list: async (ctx) => {
        const ideas = await ctx.db.ideas.findMany({ orderBy: { votes: "desc" } });
        return ui.screen("Budżet obywatelski", ideas.map((i) =>
          ui.progress({ label: i.title, value: i.votes, max: 100 })));
      },
    },
    tools: {
      vote: {
        input: z.object({ idea: z.string() }),
        handler: async (ctx, { idea }) => {
          await ctx.db.votes.insert({ idea, voter: ctx.user.id });
          return { toast: "Dziękujemy za głos!", refresh: true };
        },
      },
    },
  });`;

const KEYWORD = /^(import|type|from|const|async|await|return|export|default)$/;

/** One line of the plugin's code, lightly coloured: strings warm, keywords red. */
const CodeLine = ({ text }: { text: string }) => (
  <div style={{ whiteSpace: "pre", minHeight: 30 }}>
    {text.split(/("[^"]*"?|\b\w+\b)/).map((part, i) => (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens of a fixed line.
        key={i}
        style={{ color: part.startsWith('"') ? "#F2C46D" : KEYWORD.test(part) ? "#FF7A70" : undefined }}
      >
        {part}
      </span>
    ))}
  </div>
);

const CodePanel = ({ at, enter }: { at: number; enter: number }) => {
  const frame = useCurrentFrame();
  const lines = typed(CODE, frame, at, 9).split("\n").slice(-15);
  return (
    <div
      style={{
        width: 860,
        borderRadius: 26,
        background: "#17171A",
        boxShadow: "0 40px 90px -20px rgba(27,27,31,0.55)",
        overflow: "hidden",
        opacity: Math.min(1, enter * 1.5),
        transform: `translateX(${(1 - enter) * -900}px) perspective(2400px) rotateY(10deg)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 24px", background: "#222227" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <span style={{ marginLeft: 14, fontFamily: MONO, fontSize: 19, color: "#8A8A92" }}>budzet/index.ts</span>
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#FFFFFF",
            fontFamily: FONT.semibold,
            fontSize: 19,
          }}
        >
          <WhiteIcon icon={Sparkles} size={18} />
          AI pisze
        </span>
      </div>
      <div
        style={{
          padding: "22px 28px",
          height: 470,
          fontFamily: MONO,
          fontSize: 20,
          lineHeight: "30px",
          color: "#E7E7EA",
        }}
      >
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines of a fixed text.
          <CodeLine key={i} text={line} />
        ))}
      </div>
    </div>
  );
};

/** The checks every plugin passes before it can run (docs/plugins.md), ticked off one by one. */
const CHECKS = ["Składnia", "Importy", "Typy", "Bezpieczeństwo", "Wczytanie", "Tabele"];

const Checks = ({ from, to }: { from: number; to: number }) => {
  const frame = useCurrentFrame();
  const step = (to - from) / CHECKS.length;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, width: 880 }}>
      {CHECKS.map((label, i) => {
        const at = from + step * (i + 1);
        const done = frame >= at;
        const p = ramp(frame, at, at + 6);
        return (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 20px",
              borderRadius: 999,
              background: done ? "#FFFFFF" : "rgba(255,255,255,0.55)",
              boxShadow: done ? "0 10px 24px rgba(27,27,31,0.10)" : "none",
              fontFamily: FONT.semibold,
              fontSize: 26,
              color: done ? colors.text : colors.textSecondary,
              transform: `scale(${1 + Math.sin(p * Math.PI) * 0.1})`,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: done ? colors.primary : colors.border,
              }}
            >
              {done ? <WhiteIcon icon={Check} size={18} stroke={3.2} /> : null}
            </div>
            {label}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Residents around the new plugin, each somewhere else in the app (the app covers much more than one feature):
 * discussions, issues, the dashboard the new widget lands on, the new plugin itself, announcements.
 */
const RESIDENTS = [
  { name: "Marek", screen: <PluginScreen node={discussionsView()} /> },
  { name: "Ola", screen: <PluginScreen node={issuesListView()} /> },
  { name: "Anna", screen: null },
  { name: "Piotr", screen: <PluginScreen node={budgetView()} /> },
  { name: "Zofia", screen: <PluginScreen node={announcementsListView()} /> },
];

/** The burst of the publish tap: a red ring growing from the button. */
const Ring = ({ at, x, y }: { at: number; x: number; y: number }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + 28);
  if (frame < at || p >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 300,
        top: y - 300,
        width: 600,
        height: 600,
        borderRadius: 300,
        border: `8px solid ${colors.primary}`,
        opacity: 1 - p,
        transform: `scale(${0.2 + p * 2})`,
      }}
    />
  );
};

export const BuilderScene = () => {
  const frame = useCurrentFrame();
  const missing = useCue("brakuje");
  const admin = useCue("administrator");
  const describes = useCue("opisuje");
  const ai = useCue("ai");
  const checks = useCue("sprawdza");
  const draft = useCue("szkic");
  const click = useCue("kliknięcie");
  const works = useCue("działa");
  const phoneIn = admin - 8;
  const create = ai - 4;
  const stage: BuildStage =
    frame >= click + 4 ? "published" : frame >= draft ? "ready" : frame >= create ? "working" : "typing";
  const grid = works - 10;
  const toGrid = ramp(frame, grid, grid + 18);
  const titleOut = ramp(frame, phoneIn - 4, phoneIn + 8);
  const enter = useSpring(phoneIn, 15);
  const code = useSpring(ai - 2, 15) - ramp(frame, draft - 2, draft + 10);
  const main: Pose = {
    x: 1290 + (1 - enter) * 1000 + toGrid * (960 - 1290),
    y: 545 + toGrid * 55,
    scale: 1 - toGrid * 0.5,
    rotY: -10 * (1 - toGrid),
  };
  const residents = [budgetWidget(), issuesWidget(4, "fixed")];
  return (
    <Light drift={0.9}>
      <Center style={{ opacity: 1 - titleOut, transform: `scale(${1 + titleOut * 0.2})` }}>
        <Headline
          text={"Brakuje\nfunkcji?"}
          at={missing}
          spoken
          variant="slam"
          size={230}
          align="center"
          accent={["funkcji?"]}
        />
      </Center>

      {frame >= phoneIn && frame < ai - 2 ? (
        <div style={{ position: "absolute", left: 150, top: 330, display: "flex", flexDirection: "column", gap: 30 }}>
          <Eyebrow style={rise(ramp(frame, phoneIn, phoneIn + 12))}>{`${t.manage_title} → ${t.build_title}`}</Eyebrow>
          <Headline
            text={"Opisz ją\nwłasnymi słowami."}
            at={describes}
            spoken
            variant="slam"
            size={104}
            accent={["własnymi"]}
          />
        </div>
      ) : null}

      {frame >= ai - 2 && frame < draft + 10 ? (
        <div style={{ position: "absolute", left: 120, top: 150, display: "flex", flexDirection: "column", gap: 30 }}>
          <CodePanel at={ai} enter={code} />
          <div style={{ opacity: Math.max(0, code) }}>
            <Checks from={checks - 6} to={draft - 4} />
          </div>
        </div>
      ) : null}

      {frame >= draft + 4 && frame < grid ? (
        <div style={{ position: "absolute", left: 150, top: 360 }}>
          <Headline
            text={"Szkic gotowy.\nJedno kliknięcie."}
            at={draft + 4}
            stagger={4}
            variant="slam"
            size={104}
            accent={["kliknięcie."]}
          />
        </div>
      ) : null}

      {frame >= grid ? (
        <>
          <Headline
            text="Działa u wszystkich mieszkańców."
            at={works}
            spoken
            variant="slam"
            size={78}
            align="center"
            accent={["wszystkich"]}
            style={{ position: "absolute", left: 0, right: 0, top: 56 }}
          />
          {RESIDENTS.map((resident, i) =>
            resident.screen ? (
              <PhoneAt
                key={resident.name}
                pose={{
                  x: 960 + (i - 2) * 330,
                  y: 600 + (1 - ramp(frame, grid + Math.abs(i - 2) * 3, grid + Math.abs(i - 2) * 3 + 18)) * 800,
                  scale: 0.5,
                  rotY: (2 - i) * 6,
                }}
              >
                {resident.screen}
              </PhoneAt>
            ) : null,
          )}
        </>
      ) : null}

      <PhoneAt pose={main}>
        {frame >= grid ? (
          <DashboardScreen name="Anna" widgets={residents} arrive={ramp(frame, works - 2, works + 12)} />
        ) : (
          <>
            <Pushed
              screens={[
                { at: 0, node: <ManageScreen /> },
                {
                  at: describes - 2,
                  node: (
                    <BuildScreen
                      request={typed(REQUEST, frame, describes + 8, 2.2)}
                      stage={stage}
                      attempt={frame >= checks + 10 ? 1 : 0}
                    />
                  ),
                },
              ]}
            />
            <Tap x={195} y={717} at={describes - 8} />
            <Tap x={195} y={461} at={create - 2} />
            <Tap x={195} y={601} at={click} />
          </>
        )}
      </PhoneAt>
      <Ring at={click + 2} x={main.x} y={main.y + 100} />
    </Light>
  );
};

/* ── 8 · outro: your home, your estate, your city — Twoje Miejsce ──────────────────────────────────────── */

/** The finale's shots (clips in media.ts): the second the shot starts at, and what a stand-in says meanwhile. */
const SHOTS = {
  dom: { title: "Twój dom.", standIn: "kobieta na kanapie wieczorem, telefon w dłoni", from: 1 },
  osiedle: { title: "Twoje osiedle.", standIn: "mężczyzna na zielonym osiedlu sprawdza telefon", from: 4 },
  miasto: { title: "Twoje miasto.", standIn: "miasto z lotu ptaka o zmierzchu", from: 1 },
} as const;

type ClipId = keyof typeof SHOTS;

const STAND_IN: Record<"dom" | "osiedle", string> = {
  dom: "radial-gradient(circle at 70% 35%, #F4B36A 0%, #B5633A 38%, #3A1E17 80%)",
  osiedle: "radial-gradient(circle at 30% 30%, #F6D27A 0%, #8FA35A 40%, #2C3A23 85%)",
};

/** Red place pins landing on the map one after another. */
const MAP_PINS = [
  [420, 300],
  [760, 620],
  [1010, 380],
  [1290, 700],
  [1530, 330],
  [620, 860],
  [1700, 560],
  [260, 640],
] as const;

const Pin = ({ x, y, at }: { x: number; y: number; at: number }) => {
  const p = useSpring(at, 10, 0.6);
  return (
    <div
      style={{
        position: "absolute",
        left: x - 16,
        top: y - 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        background: colors.primary,
        border: "7px solid #FFFFFF",
        boxShadow: "0 8px 20px rgba(229,1,1,0.35)",
        opacity: Math.min(1, p * 2),
        transform: `translateY(${(1 - p) * -70}px) scale(${0.6 + p * 0.4})`,
      }}
    />
  );
};

/** One shot of the finale: the clip (or its stand-in) with a slow push, a dark corner and the big line. */
const Shot = ({ id, at, until }: { id: ClipId; at: number; until: number }) => {
  const frame = useCurrentFrame();
  const shot = SHOTS[id];
  const clip = mediaUrl(id);
  const scale =
    keys(frame, [
      [at, 1.14],
      [at + 9, 1],
    ]) *
    keys(frame, [
      [at, 1],
      [until, 1.08],
    ]);
  if (frame < at || frame >= until) return null;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        {clip ? (
          <OffthreadVideo
            src={clip}
            trimBefore={shot.from * 30}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : id === "miasto" ? (
          <AbsoluteFill
            style={{
              background: colors.background,
              transform: `scale(${keys(frame, [
                [at, 1.25],
                [until, 1],
              ])})`,
            }}
          >
            <CityMap drift={0.4} />
            {MAP_PINS.map(([x, y], i) => (
              <Pin key={`${x}-${y}`} x={x} y={y} at={at + 2 + i * 2} />
            ))}
          </AbsoluteFill>
        ) : (
          <AbsoluteFill style={{ background: STAND_IN[id] }}>
            <div
              style={{
                position: "absolute",
                right: 60,
                top: 50,
                padding: "10px 18px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.35)",
                color: "rgba(255,255,255,0.85)",
                fontFamily: FONT.medium,
                fontSize: 22,
              }}
            >
              {`ujęcie: ${shot.standIn}`}
            </div>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at center, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.15) 60%)" }}
      />
      <Center>
        <Headline
          text={shot.title}
          at={at}
          spoken
          variant="slam"
          size={170}
          align="center"
          style={{ color: "#FFFFFF", textShadow: "0 6px 40px rgba(0,0,0,0.45)" }}
        />
      </Center>
    </AbsoluteFill>
  );
};

export const OutroScene = () => {
  const frame = useCurrentFrame();
  const home = useCue("twój");
  const estate = useCue("twoje", 0);
  const city = useCue("twoje", 1);
  const place = useCue("twoje", 2);
  const name = useCue("miejsce");
  const logo = useSpring(place, 12);
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      <Shot id="dom" at={home} until={estate} />
      <Shot id="osiedle" at={estate} until={city} />
      <Shot id="miasto" at={city} until={place + 14} />
      <Wipe at={place} frames={14} color={colors.primary}>
        <Center style={{ gap: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
            <View style={{ transform: [{ scale: 0.4 + logo * 0.6 }], opacity: Math.min(1, logo * 2) }}>
              <BrandMark size={170} color="onPrimary" />
            </View>
            <Headline text="Twoje Miejsce" at={place} spoken variant="slam" size={150} style={{ color: "#FFFFFF" }} />
          </div>
          <Headline
            text="Rośnie razem z Twoją społecznością."
            at={name + 14}
            stagger={3}
            size={60}
            align="center"
            style={{ color: "#FFFFFF", fontFamily: FONT.semibold }}
          />
          <div
            style={{
              marginTop: 50,
              fontFamily: FONT.semibold,
              fontSize: 24,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
              ...rise(ramp(frame, name + 40, name + 56), 16),
            }}
          >
            HackYeah 2026 · Smart City
          </div>
        </Center>
      </Wipe>
    </AbsoluteFill>
  );
};
