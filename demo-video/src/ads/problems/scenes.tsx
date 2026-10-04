import { t } from "@app/app/src/texts";
import { Check, GraduationCap, Home, Landmark, Sparkles } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BrandMark, colors, Icon } from "../../app-ui";
import { Checks, CodePanel, Ring } from "../shared/builder";
import { Finale } from "../shared/finale";
import { Eyebrow, FONT, Headline, ramp, rise, shake, Tap, typed, useCue, useScene, useSpring } from "../shared/kit";
import { mediaUrl } from "../shared/media";
import { SCREEN } from "../shared/Phone";
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
  REPORTERS,
  ScannerScreen,
  type Status,
} from "../shared/screens";
import {
  Center,
  Counter,
  Flash,
  LeftShade,
  Light,
  NIGHT,
  PhoneAt,
  Photo,
  Pop,
  type Pose,
  Pushed,
  WhiteIcon,
} from "../shared/stage";

const REQUEST = "Głosowanie użytkowników nad pomysłami z budżetu obywatelskiego, z wynikami na pulpicie.";

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

/** One shot of the opening, shown from `from` until `to`: plain cuts between shots. */
const OpeningShot = ({ from, to, children }: { from: number; to: number; children: ReactNode }) => {
  const frame = useCurrentFrame();
  return frame >= from && frame < to ? <AbsoluteFill>{children}</AbsoluteFill> : null;
};

export const OpenScene = () => {
  const frame = useCurrentFrame();
  const { duration } = useScene();
  const fading = useCue("nie");
  const dark = useCue("świeci");
  const hole = useCue("dziura");
  const notice = useCue("ogłoszenie");
  const nobody = useCue("nikt");
  const flicker =
    frame < fading ? 1 : frame < dark ? ([1, 0.15, 0.85, 0.05, 0.5][Math.floor((frame - fading) / 2) % 5] ?? 0) : 0;
  const jolt = shake(frame, hole, 12, 12);
  const crack = ramp(frame, hole, hole + 16);
  const lit = mediaUrl("latarnia-on");
  const unlit = mediaUrl("latarnia");
  const pavement = mediaUrl("chodnik");
  const board = mediaUrl("ogloszenie");
  const lost = ramp(frame, nobody - 4, nobody + 16);
  return (
    <AbsoluteFill style={{ background: NIGHT, overflow: "hidden" }}>
      <OpeningShot from={0} to={hole}>
        {lit && unlit ? (
          <>
            <Photo src={unlit} />
            <Photo src={lit} opacity={flicker} />
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
          variant="snap"
          size={124}
          accent={["nie", "świeci."]}
          style={{ position: "absolute", left: lit ? 120 : 760, top: 330, color: "#FFFFFF" }}
        />
      </OpeningShot>
      <OpeningShot from={hole} to={notice}>
        <AbsoluteFill style={{ transform: `translate(${jolt.x}px, ${jolt.y}px)`, background: "#202127" }}>
          {pavement ? (
            <>
              <Photo src={pavement} />
              <LeftShade />
            </>
          ) : (
            <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute" }} aria-hidden>
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
                <path d="M1180 560 L1130 520 L1140 470 L1100 420" strokeWidth="6" />
              </g>
            </svg>
          )}
          <Headline
            text={"Dziura\nw chodniku."}
            at={hole}
            spoken
            variant="snap"
            size={170}
            style={{ position: "absolute", left: 150, top: 230, color: "#FFFFFF" }}
          />
        </AbsoluteFill>
      </OpeningShot>
      <OpeningShot from={notice} to={duration}>
        {board ? (
          <>
            <Photo src={board} blur={lost * 10} dim={lost * 0.35} />
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
          variant="snap"
          size={116}
          accent={["nikt"]}
          style={{ position: "absolute", left: 150, top: 230, color: "#FFFFFF" }}
        />
      </OpeningShot>
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
        <Headline text="Lokalne sprawy giną" at={0} spoken variant="snap" size={128} style={{ color: "#FFFFFF" }} />
        <Headline
          text="w grupach i formularzach."
          at={groups - 10}
          spoken
          size={64}
          style={{ color: "#9B9BA3", fontFamily: FONT.semibold }}
        />
      </Center>
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
  city: [issuesWidget(REPORTERS)],
  campus: [announcementsWidget("Biblioteka otwarta do 22:00 w czasie sesji")],
};

const FanPhone = ({ item }: { item: (typeof FAN)[number] }) => {
  const frame = useCurrentFrame();
  const named = useCue(item.cue);
  const lift = ramp(frame, named - 2, named + 8) - ramp(frame, named + 14, named + 26);
  return (
    <>
      <PhoneAt
        pose={{
          x: item.x,
          y: 660 - lift * 34,
          scale: 0.72,
          rotZ: item.rot,
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
  const toLight = one - 8;
  return (
    <AbsoluteFill style={{ background: colors.primary, overflow: "hidden" }}>
      <Center style={{ gap: 34, flexDirection: "row" }}>
        <BrandMark size={190} color="onPrimary" />
        <Headline text="Twoje Miejsce" at={name} spoken variant="snap" size={168} style={{ color: "#FFFFFF" }} />
      </Center>
      {frame >= toLight ? (
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
          {FAN.map((item) => (
            <FanPhone key={item.key} item={item} />
          ))}
        </Light>
      ) : null}
    </AbsoluteFill>
  );
};

/* ── 4 · join: the camera dives into the city's phone; scan, and you are in ─────────────────────────── */

export const JoinScene = () => {
  const frame = useCurrentFrame();
  const code = useCue("kod");
  const inside = useCue("jesteś");
  const lock = code + 2;
  const pose: Pose = { x: 960, y: 545, scale: 1.04 };
  return (
    <Light drift={1}>
      <Headline
        text={"Skanujesz\nkod"}
        at={0}
        spoken
        variant="snap"
        size={120}
        accent={["kod"]}
        style={{ position: "absolute", left: 150, top: 380 }}
      />
      <Headline
        text={"i jesteś\nw środku."}
        at={inside - 2}
        spoken
        variant="snap"
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
            { at: inside, node: <DashboardScreen widgets={[issuesWidget(REPORTERS)]} /> },
          ]}
        />
        <Flash at={lock} />
      </PhoneAt>
    </Light>
  );
};

/* ── 5 · report: a photo, the AI's duplicate check, one issue with its count ────────────────────────── */

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
  const pose: Pose = {
    x: 620,
    y: 545,
    rotY: 14,
  };
  const card = useSpring(ai, 13);
  const merged = ramp(frame, one - 4, one + 10);
  return (
    <Light drift={0.7}>
      <PhoneAt pose={pose}>
        <Pushed
          screens={[
            { at: 0, node: <DashboardScreen widgets={[issuesWidget(REPORTERS)]} /> },
            {
              at: form,
              node: <IssueFormScreen title={typed("Nie świeci latarnia", frame, photo + 6, 1.4)} />,
            },
            { at: merge, node: <PluginScreen node={mergeView()} /> },
            {
              at: joined + 6,
              node: (
                <PluginScreen
                  node={detailView({
                    support: frame >= count ? REPORTERS + 1 : REPORTERS,
                    status: "open",
                    admin: false,
                  })}
                />
              ),
            },
          ]}
        />
        <Tap x={117} y={455} at={open} />
        <Tap x={72} y={447} at={report + 2} />
        <Tap x={67} y={247} at={photo} />
        <Flash at={photo + 1} />
        <Tap x={195} y={549} at={send} />
        <Tap x={195} y={739} at={joined} />
      </PhoneAt>
      {frame < ai - 4 ? (
        <Headline
          text={"Problem zgłaszasz\nzdjęciem."}
          at={0}
          spoken
          variant="snap"
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
                <IssueCard support={layer === 0 && frame >= one ? REPORTERS + 1 : REPORTERS} />
              </div>
            ))}
          </div>
          <Headline text="Jedno zgłoszenie." at={one} spoken variant="snap" size={84} accent={["jedno"]} />
        </div>
      ) : (
        <div style={{ position: "absolute", left: 1040, top: 360 }}>
          <Counter at={count - 2} to={REPORTERS + 1} />
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
      <PhoneAt pose={{ x: 690, y: 640, scale: 0.8, rotY: 18 }}>
        <PluginScreen node={detailView({ support: REPORTERS + 1, status, admin: true })} />
        <Tap x={75} y={338} at={accepted - 2} />
        <Tap x={242} y={338} at={fixed - 2} />
      </PhoneAt>
      <PhoneAt pose={{ x: 1230, y: 640, scale: 0.8, rotY: -18 }}>
        <PluginScreen node={detailView({ support: REPORTERS + 1, status, admin: false })} />
      </PhoneAt>
      <div style={{ position: "absolute", left: 690, top: 196, transform: "translateX(-50%)" }}>
        <Eyebrow>Urząd miasta</Eyebrow>
      </div>
      <div style={{ position: "absolute", left: 1230, top: 196, transform: "translateX(-50%)" }}>
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

const RESIDENTS = [
  { name: "Marek", screen: <PluginScreen node={discussionsView()} /> },
  { name: "Ola", screen: <PluginScreen node={issuesListView()} /> },
  { name: "Anna", screen: null },
  { name: "Piotr", screen: <PluginScreen node={budgetView()} /> },
  { name: "Zofia", screen: <PluginScreen node={announcementsListView()} /> },
];

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
  const inGrid = frame >= grid;
  const coding = frame >= ai - 2 && frame < draft + 10;
  const main: Pose = inGrid
    ? { x: 960, y: 600, scale: 0.5 }
    : { x: 1290, y: 545, rotY: -10, opacity: frame >= phoneIn ? 1 : 0 };
  const residents = [budgetWidget(), issuesWidget(REPORTERS + 1, "fixed")];
  return (
    <Light drift={0.9}>
      <Center style={{ opacity: frame < phoneIn ? 1 : 0 }}>
        <Headline
          text={"Brakuje\nfunkcji?"}
          at={missing}
          spoken
          variant="snap"
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
            variant="snap"
            size={104}
            accent={["własnymi"]}
          />
        </div>
      ) : null}

      {coding ? (
        <div style={{ position: "absolute", left: 120, top: 150, display: "flex", flexDirection: "column", gap: 30 }}>
          <CodePanel at={ai} />
          <div>
            <Checks from={checks - 6} to={draft - 4} />
          </div>
        </div>
      ) : null}

      {frame >= draft + 4 && !inGrid ? (
        <div style={{ position: "absolute", left: 150, top: 360 }}>
          <Headline
            text={"Szkic gotowy.\nJedno kliknięcie."}
            at={draft + 4}
            stagger={4}
            variant="snap"
            size={104}
            accent={["kliknięcie."]}
          />
        </div>
      ) : null}

      {inGrid ? (
        <>
          <Headline
            text="Działa u wszystkich użytkowników."
            at={works}
            spoken
            variant="snap"
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
                  y: 600,
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
        {inGrid ? (
          <DashboardScreen widgets={residents} arrive={ramp(frame, works - 2, works + 12)} />
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

/* ── 8 · outro: your home, your estate, your city — Twoje Miejsce (shared/finale.tsx) ─────────────────── */

export const OutroScene = () => <Finale tagline="Rośnie razem z Twoimi potrzebami." />;
