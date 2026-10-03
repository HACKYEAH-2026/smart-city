import { Check, GraduationCap, Home, Landmark, Sparkles } from "lucide-react-native";
import type { CSSProperties, ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BrandMark, colors, Icon } from "../app-ui";
import { Eyebrow, FONT, Headline, ramp, rise, Tap, typed, useCue, useScene, useSpring } from "./kit";
import { Phone, SCREEN } from "./Phone";
import {
  announcementsWidget,
  DashboardScreen,
  detailView,
  FeaturesScreen,
  IssueFormScreen,
  issuesWidget,
  mergeView,
  PluginScreen,
  PreviewScreen,
  ScannerScreen,
} from "./screens";

/** Where the phone stands in the split scenes (its centre) and where the text column starts. */
const PHONE_X = 1400;
const TEXT_X = 150;
const NIGHT = "#15161B";
const ANNOUNCEMENT = "Remont chodnika przy szkole od poniedziałku";

/** Fades the scene's text out over its last frames, so the next scene's text can rise. */
const useExit = () => {
  const frame = useCurrentFrame();
  const { duration } = useScene();
  return 1 - ramp(frame, duration - 10, duration);
};

/** The city map behind the light scenes: streets, a river and parks in the app's map colours, drifting slowly. */
const CityMap = ({ opacity = 1 }: { opacity?: number }) => {
  const frame = useCurrentFrame();
  const shift = frame * 0.25;
  return (
    <svg
      width="2200"
      height="1300"
      viewBox="0 0 2200 1300"
      style={{ position: "absolute", left: -140 - shift, top: -110, opacity }}
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

const Light = ({ children }: { children: ReactNode }) => (
  <AbsoluteFill style={{ background: colors.background, overflow: "hidden" }}>
    <CityMap opacity={0.75} />
    {children}
  </AbsoluteFill>
);

/** Text column on the left of a split scene. */
const Column = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      position: "absolute",
      left: TEXT_X,
      top: 0,
      bottom: 0,
      width: 900,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 36,
      ...style,
    }}
  >
    {children}
  </div>
);

/** The phone in its split-scene place; `enter` 0 → 1 slides it up into view. */
const PhoneAt = ({ children, dark, enter = 1 }: { children: ReactNode; dark?: boolean; enter?: number }) => (
  <div
    style={{
      position: "absolute",
      left: PHONE_X - (SCREEN.width + 26) / 2,
      top: 540 - (SCREEN.height + 26) / 2,
      transform: `translateY(${(1 - enter) * 1100}px)`,
    }}
  >
    <Phone dark={dark} scale={0.98}>
      {children}
    </Phone>
  </div>
);

/** Phone screens pushed one after another (as the app's navigation does): each from the right at its frame. */
const Pushed = ({ screens }: { screens: { at: number; node: ReactNode; dark?: boolean }[] }) => {
  const frame = useCurrentFrame();
  const index = Math.max(
    0,
    screens.findLastIndex((s) => s.at <= frame),
  );
  const current = screens[index];
  const previous = screens[index - 1];
  const p = current && index > 0 ? ramp(frame, current.at, current.at + 14) : 1;
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
      <div
        style={{ ...layer((1 - p) * SCREEN.width, 0), boxShadow: p < 1 ? "-20px 0 40px rgba(0,0,0,0.12)" : undefined }}
      >
        {current?.node}
      </div>
    </>
  );
};

/* 1 · hook — a street lamp at night goes out as the narrator names it. */

const Lamp = ({ glow }: { glow: number }) => (
  <svg width="520" height="560" viewBox="0 0 520 560" aria-hidden>
    <defs>
      <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FFD58A" stopOpacity="0.9" />
        <stop offset="1" stopColor="#FFD58A" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFD58A" stopOpacity="0.45" />
        <stop offset="1" stopColor="#FFD58A" stopOpacity="0" />
      </linearGradient>
    </defs>
    <g opacity={glow}>
      <path d="M150 128 L40 560 L340 560 L230 128 Z" fill="url(#beam)" />
      <circle cx="190" cy="118" r="110" fill="url(#halo)" />
    </g>
    <rect x="356" y="96" width="16" height="464" rx="5" fill="#2B2C33" />
    <path
      d="M364 112 C 364 80, 330 72, 290 72 L 220 72"
      stroke="#2B2C33"
      strokeWidth="14"
      fill="none"
      strokeLinecap="round"
    />
    <path d="M140 96 L240 96 L226 122 L154 122 Z" fill="#2B2C33" />
    <rect x="156" y="120" width="68" height="10" rx="5" fill={glow > 0.5 ? "#FFE9B8" : "#3A3B44"} />
  </svg>
);

export const HookScene = () => {
  const frame = useCurrentFrame();
  const out = useCue("nie");
  const off = useCue("latarnia");
  const flicker = frame < out ? 1 : frame < off ? [1, 0.2, 0.9, 0.1, 0.6, 0][Math.floor((frame - out) / 3) % 6] : 0;
  const exit = useExit();
  return (
    <AbsoluteFill style={{ background: NIGHT, alignItems: "center", opacity: exit }}>
      <div
        style={{ marginTop: 120, opacity: ramp(frame, 0, 20), transform: "scale(1.25)", transformOrigin: "top center" }}
      >
        <Lamp glow={flicker ?? 0} />
      </div>
      <Headline
        text="Na Twojej ulicy od tygodnia nie świeci latarnia."
        at={0}
        spoken
        size={76}
        align="center"
        accent={["latarnia."]}
        style={{ color: "#FFFFFF", position: "absolute", bottom: 150 }}
      />
    </AbsoluteFill>
  );
};

/* 2 · problem — the report drowns in a neighbourhood group's feed. */

type Post = { who: string; text: string; at: number; mine?: boolean };

const FeedPost = ({ post }: { post: Post }) => {
  const p = useSpring(post.at, 16);
  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        padding: "22px 26px",
        borderRadius: 22,
        background: post.mine ? "#FFFFFF" : "#ECEBE8",
        boxShadow: post.mine ? "0 10px 30px rgba(0,0,0,0.25)" : "none",
        ...rise(p, 40),
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          background: post.mine ? colors.primaryTint : "#C9C7C2",
          flexShrink: 0,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontFamily: FONT.semibold, fontSize: 22, color: "#6B6B72" }}>{post.who}</div>
        <div style={{ fontFamily: FONT.regular, fontSize: 28, lineHeight: 1.3, color: colors.text }}>{post.text}</div>
      </div>
    </div>
  );
};

export const ProblemScene = () => {
  const frame = useCurrentFrame();
  const write = useCue("piszesz");
  const someone = useCue("ktoś");
  const other = useCue("inny");
  const lost = useCue("sprawa");
  const posts: Post[] = [
    { who: "Ty", text: "Przy przystanku od tygodnia nie świeci latarnia. Ktoś to zgłaszał?", at: write, mine: true },
    { who: "Anonimowy uczestnik", text: "Już zgłaszałem w zeszłym miesiącu.", at: someone },
    { who: "Konto bez zdjęcia", text: "To nic nie da.", at: other },
    { who: "Anonimowy uczestnik", text: "Sprzedam rower, prawie nowy.", at: lost - 2 },
    { who: "Marek", text: "Zaginął rudy kot, okolice parku!", at: lost + 4 },
    { who: "Anonimowy uczestnik", text: "Polecicie fryzjera w okolicy?", at: lost + 9 },
    { who: "Kasia", text: "Kto idzie w sobotę na mecz?", at: lost + 14 },
    { who: "Anonimowy uczestnik", text: "Znowu korek na rondzie…", at: lost + 19 },
  ];
  const scroll = interpolate(frame, [lost, lost + 40], [0, 1250], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = useExit();
  return (
    <AbsoluteFill style={{ background: NIGHT, opacity: exit }}>
      <div
        style={{
          position: "absolute",
          right: 170,
          top: 0,
          bottom: 0,
          width: 760,
          overflow: "hidden",
          maskImage: "linear-gradient(transparent, black 12%, black 88%, transparent)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            paddingTop: 330,
            transform: `translateY(${-scroll}px)`,
            filter: `blur(${ramp(frame, lost + 10, lost + 40) * 3}px)`,
          }}
        >
          {posts.map((p) => (
            <FeedPost key={`${p.at}-${p.text}`} post={p} />
          ))}
        </div>
      </div>
      <Column style={{ width: 820 }}>
        <Eyebrow style={{ color: "#8A8A92", ...rise(ramp(frame, 0, 16)) }}>Grupa mieszkańców</Eyebrow>
        {frame < lost - 4 ? (
          <Headline text={"Piszesz o tym\nw grupie."} at={0} spoken size={92} style={{ color: "#FFFFFF" }} />
        ) : (
          <Headline
            text={"I sprawa ginie\nmiędzy postami."}
            at={lost - 4}
            spoken
            size={92}
            style={{ color: "#FFFFFF" }}
          />
        )}
      </Column>
    </AbsoluteFill>
  );
};

/* 3 · reveal — the brand: pins land on the map, the logo and what it is. */

const PINS = [
  [310, 230],
  [520, 760],
  [860, 180],
  [1180, 860],
  [1540, 260],
  [1660, 700],
  [240, 520],
  [1380, 520],
] as const;

const Pin = ({ x, y, at }: { x: number; y: number; at: number }) => {
  const p = useSpring(at, 10, 0.6);
  return (
    <div
      style={{
        position: "absolute",
        left: x - 14,
        top: y - 14,
        width: 28,
        height: 28,
        borderRadius: 14,
        background: colors.primary,
        border: "6px solid #FFFFFF",
        boxShadow: "0 6px 16px rgba(229,1,1,0.35)",
        opacity: Math.min(1, p * 2),
        transform: `translateY(${(1 - p) * -60}px) scale(${0.6 + p * 0.4})`,
      }}
    />
  );
};

const Chip = ({ icon, label, at }: { icon: typeof Home; label: string; at: number }) => {
  const p = useSpring(at, 14);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 28px",
        borderRadius: 999,
        background: "#FFFFFF",
        boxShadow: "0 10px 30px rgba(27,27,31,0.10)",
        fontFamily: FONT.semibold,
        fontSize: 34,
        color: colors.text,
        ...rise(p, 30),
      }}
    >
      <View>
        <Icon icon={icon} size={34} color="primary" strokeWidth={2} />
      </View>
      {label}
    </div>
  );
};

export const RevealScene = () => {
  const frame = useCurrentFrame();
  const meet = useCue("poznaj");
  const name = useCue("twoje");
  const city = useCue("miasta");
  const estate = useCue("osiedla");
  const uni = useCue("uczelni");
  const logo = useSpring(name - 4, 12);
  const light = ramp(frame, 0, 18);
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      <AbsoluteFill style={{ opacity: light }}>
        <Light>
          {PINS.map(([x, y], i) => (
            <Pin key={`${x}-${y}`} x={x} y={y} at={meet + i * 3} />
          ))}
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 34, ...rise(logo, 40) }}>
              <View style={{ transform: [{ scale: 0.6 + logo * 0.4 }] }}>
                <BrandMark size={150} />
              </View>
              <div style={{ fontFamily: FONT.bold, fontSize: 132, letterSpacing: -4, color: colors.text }}>
                Twoje Miejsce
              </div>
            </div>
            <Headline
              text="Cyfrowa społeczność dla prawdziwego miejsca."
              at={name + 18}
              stagger={2}
              size={46}
              align="center"
              style={{ color: colors.textSecondary, fontFamily: FONT.medium, letterSpacing: -0.5 }}
            />
            <div style={{ display: "flex", gap: 22, marginTop: 10 }}>
              <Chip icon={Landmark} label="Miasto" at={city} />
              <Chip icon={Home} label="Osiedle" at={estate} />
              <Chip icon={GraduationCap} label="Uczelnia" at={uni} />
            </div>
          </AbsoluteFill>
        </Light>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 4 · join — scan the place's QR code, see the place, join, land on its dashboard. */

export const JoinScene = () => {
  const frame = useCurrentFrame();
  const qr = useCue("qr");
  const invite = useCue("zaproszenia");
  const see = useCue("widzisz");
  const enter = useSpring(0, 16);
  const found = invite - 6;
  const preview = found + 8;
  const joined = see - 4;
  const exit = useExit();
  return (
    <Light>
      <Column style={{ opacity: exit }}>
        <Eyebrow style={rise(ramp(frame, 4, 20))}>Dołączanie</Eyebrow>
        {frame < see - 2 ? (
          <Headline text={"Dołączasz kodem QR\nalbo kodem zaproszenia."} at={4} spoken accent={["QR"]} size={78} />
        ) : (
          <Headline
            text={"I od razu widzisz,\nco dzieje się w okolicy."}
            at={see - 4}
            spoken
            accent={["okolicy."]}
            size={78}
          />
        )}
      </Column>
      <PhoneAt dark={frame < preview} enter={enter}>
        <Pushed
          screens={[
            {
              at: 0,
              node: (
                <ScannerScreen
                  seen={ramp(frame, qr - 6, qr + 10)}
                  line={frame < found ? (Math.sin(frame / 9) + 1) / 2 : 0.5}
                />
              ),
            },
            { at: preview, node: <PreviewScreen /> },
            { at: joined + 6, node: <DashboardScreen widgets={[issuesWidget(3)]} /> },
          ]}
        />
        {frame >= found && frame < preview ? (
          <div
            style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: 1 - ramp(frame, found, preview) }}
          />
        ) : null}
        <Tap x={195} y={751} at={joined} />
      </PhoneAt>
    </Light>
  );
};

/* 5 · report — what happened, the category, a photo. */

const Step = ({ n, label, at }: { n: number; label: string; at: number }) => {
  const frame = useCurrentFrame();
  const p = useSpring(at, 14);
  const done = ramp(frame, at + 6, at + 14);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26, ...rise(p, 30) }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: done > 0.5 ? colors.primary : colors.primaryTint,
          color: done > 0.5 ? "#FFFFFF" : colors.primaryPressed,
          fontFamily: FONT.bold,
          fontSize: 30,
          transform: `scale(${1 + Math.sin(done * Math.PI) * 0.15})`,
        }}
      >
        {done > 0.5 ? (
          <View>
            <Icon icon={Check} size={34} color="onPrimary" strokeWidth={3} />
          </View>
        ) : (
          n
        )}
      </div>
      <div style={{ fontFamily: FONT.bold, fontSize: 60, letterSpacing: -1.5, color: colors.text }}>{label}</div>
    </div>
  );
};

export const ReportScene = () => {
  const frame = useCurrentFrame();
  const what = useCue("co");
  const category = useCue("kategoria");
  const picture = useCue("zdjęcie");
  const open = 4;
  const form = open + 8;
  const scroll = interpolate(frame, [category - 14, category - 2, picture - 16, picture - 4], [0, 200, 200, 520], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = useExit();
  return (
    <Light>
      <Column style={{ opacity: exit, gap: 44 }}>
        <Eyebrow style={rise(ramp(frame, 0, 14))}>Zgłoszenie</Eyebrow>
        <Headline text="Trzy rzeczy:" at={0} spoken size={78} />
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <Step n={1} label="Co się stało" at={what} />
          <Step n={2} label="Kategoria" at={category} />
          <Step n={3} label="Zdjęcie" at={picture} />
        </div>
      </Column>
      <PhoneAt>
        <Pushed
          screens={[
            { at: 0, node: <DashboardScreen widgets={[issuesWidget(3)]} /> },
            {
              at: form,
              node: (
                <IssueFormScreen
                  title={typed("Nie świeci latarnia", frame, what, 0.7)}
                  category={frame >= category ? "Oświetlenie" : "Inne"}
                  withPhoto={frame >= picture + 2}
                  scroll={scroll}
                />
              ),
            },
          ]}
        />
        <Tap x={195} y={516} at={open} />
        <Tap x={195} y={142} at={category} />
        <Tap x={95} y={269} at={picture} />
      </PhoneAt>
    </Light>
  );
};

/* 6 · duplicate — AI notices the same problem; one issue with a count instead of many. */

export const DuplicateScene = () => {
  const frame = useCurrentFrame();
  const ai = useCue("sztuczna");
  const instead = useCue("zamiast");
  const count = useCue("licznikiem");
  const send = 4;
  const merge = send + 8;
  const joined = instead - 2;
  const badge = useSpring(ai, 14);
  const exit = useExit();
  return (
    <Light>
      <Column style={{ opacity: exit }}>
        <Eyebrow style={rise(ramp(frame, 0, 14))}>Bez duplikatów</Eyebrow>
        {frame < instead - 4 ? (
          <>
            <Headline text={"Ktoś zgłosił\nto wcześniej?"} at={6} spoken size={84} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                alignSelf: "flex-start",
                padding: "14px 24px",
                borderRadius: 999,
                background: colors.text,
                color: "#FFFFFF",
                fontFamily: FONT.semibold,
                fontSize: 30,
                ...rise(badge, 24),
              }}
            >
              <View>
                <Icon icon={Sparkles} size={28} color="onPrimary" strokeWidth={2} />
              </View>
              AI wykrywa ten sam problem
            </div>
          </>
        ) : (
          <>
            <Headline
              text={"Jedno zgłoszenie\nzamiast wielu."}
              at={instead - 2}
              stagger={3}
              accent={["jedno"]}
              size={84}
            />
            <div
              style={{
                fontFamily: FONT.semibold,
                fontSize: 40,
                color: colors.textSecondary,
                ...rise(ramp(frame, count - 2, count + 12), 20),
              }}
            >
              z licznikiem osób, które widzą problem
            </div>
          </>
        )}
      </Column>
      <PhoneAt>
        <Pushed
          screens={[
            {
              at: 0,
              node: <IssueFormScreen title="Nie świeci latarnia" category="Oświetlenie" withPhoto scroll={520} />,
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
        <Tap x={195} y={598} at={send} />
        <Tap x={195} y={718} at={joined} />
      </PhoneAt>
    </Light>
  );
};

/* 7 · city — the city's view: what bothers people most, accepted, fixed; the resident sees each step. */

const STATUS_STEPS = ["Nowe", "Przyjęte", "Naprawione"] as const;

const Stepper = ({ reached }: { reached: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
    {STATUS_STEPS.map((s, i) => {
      const on = reached >= i;
      return (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {i > 0 ? (
            <div style={{ width: 46, height: 4, borderRadius: 2, background: on ? colors.primary : colors.border }} />
          ) : null}
          <div
            style={{
              padding: "14px 26px",
              borderRadius: 999,
              fontFamily: FONT.semibold,
              fontSize: 32,
              background: on ? colors.primary : "#FFFFFF",
              color: on ? "#FFFFFF" : colors.textSecondary,
              boxShadow: "0 8px 24px rgba(27,27,31,0.08)",
              transform: `scale(${on ? 1 : 0.94})`,
            }}
          >
            {s}
          </div>
        </div>
      );
    })}
  </div>
);

export const CityScene = () => {
  const frame = useCurrentFrame();
  const accepts = useCue("przyjmuje");
  const fixed = useCue("naprawione");
  const you = useCue("ty");
  const detail = accepts - 16;
  const exit = useExit();
  const status = frame >= fixed + 2 ? "fixed" : frame >= accepts + 2 ? "accepted" : "open";
  return (
    <Light>
      <Column style={{ opacity: exit, gap: 44 }}>
        <Eyebrow style={rise(ramp(frame, 0, 14))}>Urząd miasta</Eyebrow>
        <Headline text={"Urząd widzi, co\nprzeszkadza najbardziej."} at={0} spoken size={76} />
        <div style={rise(ramp(frame, accepts - 10, accepts + 6), 24)}>
          <Stepper reached={status === "fixed" ? 2 : status === "accepted" ? 1 : 0} />
        </div>
        <div
          style={{
            fontFamily: FONT.semibold,
            fontSize: 40,
            color: colors.textSecondary,
            ...rise(ramp(frame, you - 2, you + 12), 20),
          }}
        >
          Mieszkaniec widzi każdy krok.
        </div>
      </Column>
      <PhoneAt>
        <Pushed
          screens={[
            { at: 0, node: <DashboardScreen admin widgets={[issuesWidget(4)]} /> },
            { at: detail, node: <PluginScreen node={detailView({ support: 4, status, admin: true })} /> },
          ]}
        />
        <Tap x={154} y={332} at={detail - 8} />
        <Tap x={75} y={338} at={accepts} />
        <Tap x={242} y={338} at={fixed} />
      </PhoneAt>
    </Light>
  );
};

/* 8 · announce — the city's announcement lands on the residents' dashboard. */

export const AnnounceScene = () => {
  const frame = useCurrentFrame();
  const lands = useCue("ogłoszenie");
  const exit = useExit();
  const p = useSpring(lands, 14);
  return (
    <Light>
      <Column style={{ opacity: exit }}>
        <Eyebrow style={rise(ramp(frame, 0, 14))}>Ogłoszenia</Eyebrow>
        <Headline text={"Ogłoszenie trafia\nprosto na pulpit."} at={lands - 6} spoken accent={["pulpit"]} size={84} />
      </Column>
      <PhoneAt>
        <DashboardScreen
          widgets={
            frame >= lands ? [announcementsWidget(ANNOUNCEMENT), issuesWidget(4, "fixed")] : [issuesWidget(4, "fixed")]
          }
        />
        {frame >= lands ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              boxShadow: `inset 0 0 0 ${(1 - p) * 8}px ${colors.primary}`,
              borderRadius: 55,
              opacity: 1 - p,
            }}
          />
        ) : null}
      </PhoneAt>
    </Light>
  );
};

/* 9 · plugins — every place turns on what it needs; each feature is a plugin. */

const PluginTile = ({ emoji, label, at, dashed }: { emoji: string; label: string; at: number; dashed?: boolean }) => {
  const p = useSpring(at, 12);
  return (
    <div
      style={{
        width: 196,
        height: 176,
        borderRadius: 26,
        background: dashed ? "transparent" : "#FFFFFF",
        border: dashed ? `3px dashed ${colors.dashed}` : "none",
        boxShadow: dashed ? "none" : "0 14px 34px rgba(27,27,31,0.10)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        fontFamily: FONT.semibold,
        fontSize: 26,
        color: dashed ? colors.textSecondary : colors.text,
        opacity: Math.min(1, p * 1.5),
        transform: `translateY(${(1 - p) * 60}px) rotate(${(1 - p) * -8}deg)`,
      }}
    >
      <div style={{ fontSize: 56 }}>{emoji}</div>
      {label}
    </div>
  );
};

export const PluginsScene = () => {
  const frame = useCurrentFrame();
  const turns = useCue("włącza");
  const needed = useCue("potrzebne");
  const features = useCue("funkcje");
  const plugin = useCue("wtyczka");
  const rebuild = useCue("przebudowy");
  const exit = useExit();
  const on = frame >= features ? 3 : frame >= needed ? 2 : frame >= turns ? 1 : 0;
  return (
    <Light>
      <Column style={{ opacity: exit, gap: 44 }}>
        <Eyebrow style={rise(ramp(frame, 0, 14))}>Wtyczki</Eyebrow>
        <Headline text={"Każde miejsce włącza\ntylko potrzebne funkcje."} at={0} spoken size={72} />
        <div style={{ display: "flex", gap: 20 }}>
          <PluginTile emoji="🛠️" label="Zgłoszenia" at={plugin} />
          <PluginTile emoji="📢" label="Ogłoszenia" at={plugin + 4} />
          <PluginTile emoji="💬" label="Dyskusje" at={plugin + 8} />
          <PluginTile emoji="+" label="Kolejna" at={rebuild - 4} dashed />
        </div>
      </Column>
      <PhoneAt>
        <FeaturesScreen on={on} />
        <Tap x={54} y={312} at={turns} />
        <Tap x={54} y={418} at={needed} />
        <Tap x={54} y={546} at={features} />
      </PhoneAt>
    </Light>
  );
};

/* 10 · outro — phone and browser, then the brand and its line. */

const Browser = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      width: 980,
      height: 640,
      borderRadius: 22,
      background: "#FFFFFF",
      overflow: "hidden",
      boxShadow: "0 50px 100px -30px rgba(27,27,31,0.40)",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 20px",
        background: colors.surfaceSunken,
      }}
    >
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
        <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
      ))}
      <div
        style={{
          marginLeft: 20,
          flex: 1,
          height: 32,
          borderRadius: 10,
          background: "#FFFFFF",
          fontFamily: FONT.medium,
          fontSize: 17,
          color: colors.textSecondary,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
        }}
      >
        Twoje Miejsce — Kraków
      </div>
    </div>
    <div
      style={{ flex: 1, display: "flex", justifyContent: "center", background: colors.background, overflow: "hidden" }}
    >
      <div style={{ width: SCREEN.width, height: 900, display: "flex", flexDirection: "column" }}>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: SCREEN.width, height: 900 },
            insets: { top: 0, bottom: 0, left: 0, right: 0 },
          }}
          style={{ flex: 1 }}
        >
          {children}
        </SafeAreaProvider>
      </div>
    </div>
  </div>
);

export const OutroScene = () => {
  const frame = useCurrentFrame();
  const brand = useCue("twoje");
  const line = useCue("miasto");
  const devices = useSpring(0, 16);
  const phone = useSpring(6, 16);
  const away = ramp(frame, brand - 10, brand + 6);
  const logo = useSpring(brand, 12);
  const widgets = [announcementsWidget(ANNOUNCEMENT), issuesWidget(4, "fixed")];
  return (
    <Light>
      <AbsoluteFill style={{ opacity: 1 - away, transform: `scale(${1 - away * 0.08})` }}>
        <div style={{ position: "absolute", left: 160, top: 210, ...rise(devices, 80) }}>
          <Browser>
            <DashboardScreen widgets={widgets} />
          </Browser>
        </div>
        <div style={{ position: "absolute", left: 1170, top: 105, ...rise(phone, 120) }}>
          <Phone scale={0.98}>
            <DashboardScreen widgets={widgets} />
          </Phone>
        </div>
        <Headline
          text="Na telefonie i w przeglądarce."
          at={0}
          spoken
          size={52}
          style={{ position: "absolute", left: 160, top: 100 }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", gap: 36, opacity: Math.min(1, logo * 1.5) }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 34, transform: `scale(${0.85 + logo * 0.15})` }}>
          <BrandMark size={150} />
          <div style={{ fontFamily: FONT.bold, fontSize: 132, letterSpacing: -4, color: colors.text }}>
            Twoje Miejsce
          </div>
        </div>
        <Headline text="Miasto bliżej ludzi." at={line} spoken size={64} align="center" accent={["ludzi."]} />
        <div
          style={{
            marginTop: 40,
            fontFamily: FONT.semibold,
            fontSize: 24,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: colors.textSecondary,
            ...rise(ramp(frame, line + 20, line + 36), 16),
          }}
        >
          HackYeah 2026 · Smart City
        </div>
      </AbsoluteFill>
    </Light>
  );
};
