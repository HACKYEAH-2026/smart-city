import { t } from "@app/app/src/texts";
import {
  Briefcase,
  Building2,
  GraduationCap,
  House,
  Landmark,
  type LucideIcon,
  School,
  Sparkles,
  Ticket,
  Trees,
  Trophy,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BrandMark, colors, Icon } from "../../app-ui";
import { BOOKING_CODE, Checks, CodePanel, Ring } from "../shared/builder";
import { Finale } from "../shared/finale";
import { Eyebrow, FONT, Headline, keys, ramp, rise, Tap, typed, useCue, useScene, useSpring } from "../shared/kit";
import type { MediaId } from "../shared/media";
import {
  announcementsWidget,
  BUILT_BOOKING,
  BuildScreen,
  type BuildStage,
  bookingDoneView,
  bookingFormView,
  bookingScheduleView,
  bookingWidget,
  budgetWidget,
  COOP_ISSUE,
  calendarWidget,
  DashboardScreen,
  discussionsWidget,
  IssueFormScreen,
  issueFormView,
  issuesWidget,
  joinedView,
  mergeView,
  PluginScreen,
  PreviewScreen,
  photoWidget,
  REPORTERS,
  ScannerScreen,
} from "../shared/screens";
import {
  Center,
  ClipVideo,
  Counter,
  Flash,
  Light,
  NIGHT,
  PhoneAt,
  Pop,
  type Pose,
  Pushed,
  SAFE,
  WhiteIcon,
} from "../shared/stage";
import { bookingCalendarWidget, SizedDashboard, type Tile } from "./screens";

/** Where the phone stands in the split scenes, and the text column to its left. */
const PHONE = { x: 1290, y: 545, rotY: -10 };
const REQUEST = "Rezerwacja sal: studenci wybierają salę i godzinę, a dziekanat widzi grafik wszystkich sal.";

/** The shot a community's scene opens on while the narrator names it: its clip, full frame, with its name. */
const Establishing = ({ id, from, label, until }: { id: MediaId; from: number; label: string; until: number }) => (
  <AbsoluteFill style={{ background: NIGHT }}>
    <ClipVideo id={id} from={from} at={0} until={until} />
    <AbsoluteFill
      style={{ background: "radial-gradient(ellipse at center, rgba(10,10,12,0.5), rgba(10,10,12,0.1) 65%)" }}
    />
    <Center>
      <Headline
        text={label}
        at={0}
        variant="snap"
        size={150}
        align="center"
        style={{ color: "#FFFFFF", textShadow: "0 6px 40px rgba(0,0,0,0.45)" }}
      />
    </Center>
  </AbsoluteFill>
);

/** Eyebrow and headline in the column left of the phone. */
const Column = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      position: "absolute",
      left: 150,
      top: 0,
      bottom: 0,
      width: 860,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 30,
    }}
  >
    {children}
  </div>
);

/* ── 1 · intro: a city, a campus, a housing cooperative and more — each has its own needs ───────────── */

/** A panel of the opening: a community's clip (from `from` seconds), or, without one, the „i więcej” panel. */
type Panel = { name: string; label: string; cue: string; clip?: { id: MediaId; from: number } };

const PANELS: Panel[] = [
  { name: "city", label: "Miasto", cue: "miasto", clip: { id: "miasto", from: 1 } },
  { name: "campus", label: "Uczelnia", cue: "uczelnia", clip: { id: "kampus", from: 0 } },
  { name: "coop", label: "Spółdzielnia", cue: "spółdzielnia", clip: { id: "spoldzielnia", from: 1 } },
  { name: "more", label: "i więcej", cue: "wiele" },
];

/** Other kinds of communities a place can be: a school, a company, a club, an event, a village, a home. */
const MORE: LucideIcon[] = [School, Briefcase, Trophy, Ticket, Trees, House];

/** Where the campus panel cuts to the QR clip: she is at the poster, raising her phone to its code. */
const QR_FROM = 5;
/** The QR clip's second her phone is up against the code: the scene ends there and the app's scanner takes over. */
const QR_SCAN = 7.2;

/** One kind of community in the „i więcej” panel: a ring with its icon that pops in at `at` and floats. */
const MoreIcon = ({ icon, at, phase }: { icon: LucideIcon; at: number; phase: number }) => {
  const frame = useCurrentFrame();
  const p = useSpring(at, 11, 0.6);
  return (
    <div
      style={{
        width: 112,
        height: 112,
        borderRadius: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.08)",
        border: "2px solid rgba(255,255,255,0.22)",
        opacity: frame < at ? 0 : Math.min(1, p * 2),
        transform: `translateY(${Math.sin(frame / 18 + phase) * 6}px) scale(${0.4 + p * 0.6})`,
      }}
    >
      <WhiteIcon icon={icon} size={50} stroke={1.8} />
    </div>
  );
};

/** „i więcej”: no clip, but the other kinds of communities popping in one after another over a dark panel. */
const MorePanel = ({ at }: { at: number }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 38%, ${colors.primary}55, rgba(20,21,25,0) 62%), #1E1F25`,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 112px)", gap: 28, marginBottom: 140 }}>
      {MORE.map((icon, i) => (
        <MoreIcon key={icon.displayName ?? i} icon={icon} at={at + 2 + i * 3} phase={i * 1.3} />
      ))}
    </div>
  </AbsoluteFill>
);

const IntroPanel = ({
  label,
  cue,
  clip,
  middle,
  grow,
  dim,
  handoff,
}: Panel & { middle: boolean; grow: number; dim: number; handoff: number }) => {
  const frame = useCurrentFrame();
  const { duration } = useScene();
  const at = useCue(cue);
  const flex = middle ? 1 + (PANELS.length - 1) * grow : 1 - grow;
  if (frame < at) return <div style={{ flex }} />;
  return (
    <div style={{ flex, position: "relative", overflow: "hidden" }}>
      {!clip ? (
        <MorePanel at={at} />
      ) : middle && frame >= handoff ? (
        <ClipVideo id="kampus-qr" from={QR_FROM} at={handoff} until={duration} span={QR_SCAN - QR_FROM} />
      ) : (
        <ClipVideo id={clip.id} from={clip.from} at={at} until={middle ? handoff : duration} />
      )}
      <AbsoluteFill
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0) 45%)", opacity: 1 - grow }}
      />
      <AbsoluteFill style={{ background: "rgba(10,10,12,0.55)", opacity: dim }} />
      <Headline
        text={label}
        at={at}
        variant="snap"
        size={58}
        style={{ position: "absolute", left: 40, bottom: SAFE, color: "#FFFFFF", opacity: 1 - grow }}
      />
    </div>
  );
};

/**
 * Four panels side by side, each as the narrator names it: three communities and „i więcej”. With „Każda
 * społeczność…” the line comes up over them and the campus opens up to the whole frame; its student reaches a QR
 * code and raises her phone to it: the next scene is the app's scanner.
 */
export const IntroScene = () => {
  const frame = useCurrentFrame();
  const scene = useScene();
  const each = useCue("każda");
  const end = scene.words.at(-1)?.to ?? 0;
  const expandAt = each + 24;
  const handoff = expandAt + 22;
  const grow = keys(frame, [
    [expandAt, 0],
    [expandAt + 18, 1],
  ]);
  const lineOut = keys(frame, [
    [end + 4, 0],
    [end + 14, 1],
  ]);
  const dim = frame >= each ? 1 - lineOut : 0;
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", gap: 6 * (1 - grow) }}>
        {PANELS.map((panel) => (
          <IntroPanel
            key={panel.name}
            {...panel}
            middle={panel.name === "campus"}
            grow={grow}
            dim={dim}
            handoff={handoff}
          />
        ))}
      </div>
      {frame >= each ? (
        <Center style={{ opacity: 1 - lineOut }}>
          <Headline
            text={"Każda społeczność\nma swoje potrzeby."}
            at={each}
            spoken
            variant="snap"
            size={96}
            align="center"
            accent={["swoje"]}
            style={{ color: "#FFFFFF", textShadow: "0 6px 40px rgba(0,0,0,0.5)" }}
          />
        </Center>
      ) : null}
    </AbsoluteFill>
  );
};

/* ── 2 · promise: one app that fits each of them ────────────────────────────────────────────────────── */

const CAMPUS_WIDGETS = [
  calendarWidget(),
  bookingWidget(),
  announcementsWidget("Biblioteka otwarta do 22:00 w czasie sesji", "Dzień otwarty wydziału w czwartek"),
];

const PLACES = [
  {
    key: "city",
    place: "Kraków",
    label: "Miasto",
    icon: Landmark,
    x: 520,
    widgets: [photoWidget("cityAtNight", "Kraków o zmierzchu"), budgetWidget(), issuesWidget(REPORTERS)],
  },
  { key: "campus", place: "Kampus Główny", label: "Uczelnia", icon: GraduationCap, x: 960, widgets: CAMPUS_WIDGETS },
  {
    key: "coop",
    place: "Spółdzielnia Słoneczna",
    label: "Spółdzielnia",
    icon: Building2,
    x: 1400,
    widgets: [
      issuesWidget(REPORTERS, "open", COOP_ISSUE),
      photoWidget("mural", "Mural na bloku przy ul. Słonecznej"),
      discussionsWidget(),
    ],
  },
] as const;

/** Picked up from the intro's last shot: her phone's scanner reads the code, she joins the campus, its dashboard. */
const CampusJoin = () => {
  const frame = useCurrentFrame();
  const name = useCue("twoje");
  const one = useCue("jedna");
  const lock = 8;
  const preview = lock + 6;
  const join = one - 4;
  return (
    <Light drift={0.6}>
      <Column>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            ...rise(
              keys(frame, [
                [name - 2, 0],
                [name + 8, 1],
              ]),
              14,
            ),
          }}
        >
          <BrandMark size={70} />
          <div style={{ fontFamily: FONT.bold, fontSize: 64, letterSpacing: -1.5, color: colors.text }}>
            Twoje Miejsce
          </div>
        </div>
        <Headline text="Jedna aplikacja." at={one - 2} spoken variant="snap" size={110} accent={["jedna"]} />
      </Column>
      <PhoneAt pose={PHONE} dark={frame < preview}>
        <Pushed
          screens={[
            { at: 0, node: <ScannerScreen seen={1} line={frame < lock ? (Math.sin(frame / 3) + 1) / 2 : 0.5} /> },
            {
              at: preview,
              node: <PreviewScreen place="Kampus Główny" address="ul. Akademicka 1, Kraków" code="KMP-GLW" />,
            },
            { at: join + 6, node: <DashboardScreen place="Kampus Główny" widgets={CAMPUS_WIDGETS} /> },
          ]}
        />
        <Flash at={lock} />
        <Tap x={195} y={752} at={join} />
      </PhoneAt>
    </Light>
  );
};

export const PromiseScene = () => {
  const frame = useCurrentFrame();
  const fits = useCue("dopasowuje") - 3;
  const each = useCue("każdej");
  if (frame < fits) return <CampusJoin />;
  return (
    <Light drift={0.8}>
      <Headline
        text="Dopasowuje się do każdej."
        at={fits}
        spoken
        variant="snap"
        size={72}
        align="center"
        accent={["każdej."]}
        style={{ position: "absolute", left: 0, right: 0, top: 60 }}
      />
      {PLACES.map((p, i) => (
        <div key={p.key}>
          <PhoneAt pose={{ x: p.x, y: 585, scale: 0.68 }}>
            <DashboardScreen place={p.place} widgets={[...p.widgets]} />
          </PhoneAt>
          <div style={{ position: "absolute", left: p.x, bottom: SAFE, transform: "translateX(-50%)" }}>
            <Pop at={each + i * 5} style={{ background: "#FFFFFF", color: colors.text }}>
              <View>
                <Icon icon={p.icon} size={34} color="primary" strokeWidth={2} />
              </View>
              {p.label}
            </Pop>
          </div>
        </div>
      ))}
    </Light>
  );
};

/* ── 3 · city: it asks for a feature, the app answers at once — and its dashboard gets it ──────────── */

/** What the city asks for, the answer, and the widget that lands on its dashboard with the answer. */
const ASKS = [
  { ask: "Budżet obywatelski?", answer: "Mamy to!", widget: budgetWidget() },
  {
    ask: "Lokalne ogłoszenia?",
    answer: "Się robi!",
    widget: announcementsWidget("Remont chodnika przy szkole od poniedziałku"),
  },
  { ask: "Zgłoszenia zagrożeń?", answer: "Nie ma sprawy!", widget: issuesWidget(REPORTERS) },
];

/** A question in ink as the narrator asks it, and the answer in red that bounces in; dimmed once the next is asked. */
const Exchange = ({
  ask,
  at,
  answer,
  answerAt,
  until,
}: {
  ask: string;
  at: number;
  answer: string;
  answerAt: number;
  until?: number;
}) => {
  const frame = useCurrentFrame();
  const p = useSpring(answerAt, 9, 0.6);
  const dim = until === undefined ? 0 : ramp(frame, until - 2, until + 8);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: 1 - dim * 0.65 }}>
      <Headline text={ask} at={at} spoken variant="snap" size={80} />
      <div
        style={{
          fontFamily: FONT.bold,
          fontSize: 80,
          lineHeight: 1.04,
          letterSpacing: -80 * 0.03,
          color: colors.primary,
          transformOrigin: "left center",
          opacity: frame < answerAt ? 0 : Math.min(1, p * 2),
          transform: `scale(${0.6 + p * 0.4}) rotate(${(1 - p) * -6}deg)`,
        }}
      >
        {answer}
      </div>
    </div>
  );
};

/**
 * Over the city's clip the narrator names it; then each question comes up on the left, the answer bounces in under
 * it, and with each answer its feature lands on top of Kraków's dashboard on the right.
 */
export const CityScene = () => {
  const frame = useCurrentFrame();
  // When each question is asked and answered, in the order of ASKS.
  const asked = [useCue("budżet"), useCue("lokalne"), useCue("zgłoszenia")];
  const answered = [useCue("mamy"), useCue("się"), useCue("nie")];
  const asks = ASKS.map((a, i) => ({ ...a, at: (asked[i] ?? 0) - 2, answerAt: (answered[i] ?? 0) - 1 }));
  const first = asks[0]?.at ?? 0;
  const landed = asks.filter((a) => frame >= a.answerAt);
  const last = landed.at(-1);
  if (frame < first) return <Establishing id="miasto" from={1} label="Miasto" until={first} />;
  return (
    <Light drift={0.6}>
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 0,
          bottom: 0,
          width: 860,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 44,
        }}
      >
        <Eyebrow>Miasto</Eyebrow>
        {asks.map((a, i) => (
          <Exchange key={a.ask} ask={a.ask} at={a.at} answer={a.answer} answerAt={a.answerAt} until={asks[i + 1]?.at} />
        ))}
      </div>
      <PhoneAt pose={PHONE}>
        <DashboardScreen
          widgets={[...landed.map((a) => a.widget).reverse(), photoWidget("cityAtNight", "Kraków o zmierzchu")]}
          arrive={last ? ramp(frame, last.answerAt, last.answerAt + 14) : 1}
        />
      </PhoneAt>
    </Light>
  );
};

/* ── 4 · campus: room booking — a student books, the dean's office sees the schedule ──────────────── */

export const CampusScene = () => {
  const frame = useCurrentFrame();
  const offer = useCue("udostępnić");
  const booking = useCue("rezerwację");
  const office = useCue("dziekanat");
  const hour = booking + 10;
  const book = office - 14;
  const picked = frame >= hour + 2;
  if (frame < offer - 2) return <Establishing id="kampus" from={4} label="Uczelnia" until={offer - 2} />;
  if (frame >= office - 2) {
    return (
      <Light drift={0.6}>
        <Headline
          text="Dziekanat widzi grafik."
          at={office - 2}
          spoken
          variant="snap"
          size={72}
          align="center"
          accent={["grafik."]}
          style={{ position: "absolute", left: 0, right: 0, top: 54 }}
        />
        <PhoneAt pose={{ x: 690, y: 625, scale: 0.8, rotY: 18 }}>
          <PluginScreen node={bookingDoneView()} />
        </PhoneAt>
        <PhoneAt pose={{ x: 1230, y: 625, scale: 0.8, rotY: -18 }}>
          <PluginScreen node={bookingScheduleView()} />
        </PhoneAt>
        <div style={{ position: "absolute", left: 690, top: 196, transform: "translateX(-50%)" }}>
          <Eyebrow>Studentka</Eyebrow>
        </div>
        <div style={{ position: "absolute", left: 1230, top: 196, transform: "translateX(-50%)" }}>
          <Eyebrow>Dziekanat</Eyebrow>
        </div>
      </Light>
    );
  }
  return (
    <Light drift={0.6}>
      <Column>
        <Eyebrow>Uczelnia</Eyebrow>
        <Headline text={"Rezerwacja\nsal."} at={booking - 2} spoken variant="snap" size={110} accent={["sal."]} />
      </Column>
      <PhoneAt pose={PHONE}>
        <Pushed
          screens={[
            {
              at: 0,
              // A new tree per pick: the renderer's form takes its values from the tree when it mounts.
              node: <PluginScreen key={picked ? "picked" : "empty"} node={bookingFormView(picked ? "12:00" : "")} />,
            },
            { at: book + 4, node: <PluginScreen node={bookingDoneView()} /> },
          ]}
        />
        <Tap x={205} y={612} at={hour} />
        <Tap x={195} y={752} at={book} />
      </PhoneAt>
    </Light>
  );
};

/* ── 5 · housing cooperative: issue reports; the AI joins duplicates ──────────────────────────────── */

export const CoopScene = () => {
  const frame = useCurrentFrame();
  const collects = useCue("zbiera");
  const reports = useCue("zgłoszenia");
  const ai = useCue("ai");
  const joins = useCue("łączy");
  const duplicates = useCue("duplikaty");
  const send = ai - 8;
  const sheetAt = send + 4;
  const join = joins + 2;
  const open = keys(frame, [
    [sheetAt, 0],
    [sheetAt + 10, 1],
  ]);
  const sheet = frame < sheetAt ? undefined : frame >= join + 4 ? joinedView(REPORTERS + 1) : mergeView(COOP_ISSUE);
  if (frame < collects - 2)
    return <Establishing id="spoldzielnia" from={1} label="Spółdzielnia" until={collects - 2} />;
  return (
    <Light drift={0.6}>
      <Column>
        <Eyebrow>Spółdzielnia mieszkaniowa</Eyebrow>
        <Headline
          text={"Zgłoszenia\nusterek."}
          at={reports - 2}
          spoken
          variant="snap"
          size={110}
          accent={["usterek."]}
        />
        <Pop at={ai} style={{ background: colors.text, color: "#FFFFFF", alignSelf: "flex-start" }}>
          <WhiteIcon icon={Sparkles} />
          AI łączy duplikaty
        </Pop>
        {frame >= duplicates ? <Counter at={duplicates} to={REPORTERS + 1} /> : null}
      </Column>
      <PhoneAt pose={PHONE}>
        {sheet ? (
          <PluginScreen node={issueFormView(COOP_ISSUE.title, COOP_ISSUE)} sheet={{ node: sheet, open }} />
        ) : (
          <IssueFormScreen title={typed(COOP_ISSUE.title, frame, collects + 4, 0.9)} issue={COOP_ISSUE} />
        )}
        <Tap x={195} y={752} at={send} />
        <Tap x={195} y={596} at={join} />
      </PhoneAt>
    </Light>
  );
};

/* ── 6 · builder: what is missing, described in the app; the AI writes it ─────────────────────────── */

export const BuilderScene = () => {
  const frame = useCurrentFrame();
  const { duration } = useScene();
  const missing = useCue("czegoś");
  const admin = useCue("administrator");
  const describes = useCue("opisuje");
  const ai = useCue("ai");
  const writes = useCue("pisze");
  const ready = duration - 30;
  const create = ai - 6;
  const stage: BuildStage = frame >= ready ? "ready" : frame >= create + 4 ? "working" : "typing";
  if (frame < admin - 4) {
    return (
      <Light drift={0.9}>
        <Center>
          <Headline
            text={"Czegoś\nbrakuje?"}
            at={missing}
            spoken
            variant="snap"
            size={210}
            align="center"
            accent={["brakuje?"]}
          />
        </Center>
      </Light>
    );
  }
  return (
    <Light drift={0.9}>
      {frame < ai - 2 ? (
        <Column>
          <Eyebrow>{`${t.manage_title} → ${t.build_title}`}</Eyebrow>
          <Headline
            text={"Opisz funkcję\nwłasnymi słowami."}
            at={describes - 2}
            spoken
            variant="snap"
            size={100}
            accent={["własnymi"]}
          />
        </Column>
      ) : frame < ready ? (
        <div style={{ position: "absolute", left: 120, top: 150, display: "flex", flexDirection: "column", gap: 30 }}>
          <CodePanel at={ai} code={BOOKING_CODE} file="sale/index.ts" />
          <Checks from={writes - 4} to={ready - 4} />
        </div>
      ) : (
        <Column>
          <Headline text={"Rozszerzenie\ngotowe."} at={ready} variant="snap" size={110} accent={["gotowe."]} />
        </Column>
      )}
      <PhoneAt pose={PHONE}>
        <BuildScreen
          request={typed(REQUEST, frame, admin + 2, 1.6)}
          stage={stage}
          built={BUILT_BOOKING}
          place="Kampus Główny"
        />
        <Tap x={195} y={752} at={create} />
      </PhoneAt>
    </Light>
  );
};

/* ── 7 · publish: one tap on „Opublikuj w miejscu”; the plugin is on every member's dashboard, live ──── */

/** The campus dashboard before the new plugin (the size each plugin declares for its widget). */
const CAMPUS_BEFORE: Tile[] = [
  {
    node: announcementsWidget("Biblioteka otwarta do 22:00 w czasie sesji", "Dzień otwarty wydziału w czwartek"),
    w: 3,
    h: 2,
  },
  { node: discussionsWidget(), w: 3, h: 3 },
];

/** The campus dashboard with the new plugin's widget on top. */
const campusWith = (live: boolean): Tile[] => [{ node: bookingCalendarWidget(live), w: 3, h: 3 }, ...CAMPUS_BEFORE];

/** Once the camera pulls back: the admin's phone in the middle, two members' phones beside it. */
const ADMIN_PHONE: Pose = { x: 960, y: 600, scale: 0.9, rotY: 0 };
const MEMBERS: { pose: Pose; from: number }[] = [
  { pose: { x: 490, y: 615, scale: 0.8, rotY: 16 }, from: -1 },
  { pose: { x: 1430, y: 615, scale: 0.8, rotY: -16 }, from: 1 },
];

/** The pose `p` of the way from `a` to `b`. */
const between = (a: Pose, b: Pose, p: number): Pose => {
  const mix = (x = 0, y = 0) => x + (y - x) * p;
  return {
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    scale: mix(a.scale ?? 1, b.scale ?? 1),
    rotY: mix(a.rotY, b.rotY),
  };
};

/**
 * The draft from the builder scene: „Opublikuj w miejscu” is tapped and the screen says the version runs in the
 * place. The camera pulls back: the campus dashboard on the admin's phone and on two members' phones gets the new
 * widget (its week of dates and the day's bookings) without an app update, and when someone books a room, the
 * booking shows up on all of them (the dashboard refreshes itself).
 */
export const PublishScene = () => {
  const frame = useCurrentFrame();
  const one = useCue("jedno");
  const click = useCue("kliknięcie");
  const works = useCue("działa");
  const live = useCue("żywo");
  const tap = click + 4;
  const pull = works - 2;
  const back = keys(frame, [
    [pull, 0],
    [pull + 18, 1],
  ]);
  const admin = between(PHONE, ADMIN_PHONE, back);
  const booked = frame >= live;
  const pulse = frame >= live ? ramp(frame, live, live + 26) : 0;
  return (
    <Light drift={0.9}>
      {frame < pull + 10 ? (
        <Column>
          <div style={{ opacity: 1 - back }}>
            <Headline
              text={"Jedno\nkliknięcie."}
              at={one - 2}
              spoken
              variant="snap"
              size={130}
              accent={["kliknięcie."]}
            />
          </div>
        </Column>
      ) : null}
      {frame >= pull ? (
        <Headline
          text="Działa u wszystkich. Na żywo."
          at={works}
          spoken
          variant="snap"
          size={78}
          align="center"
          accent={["żywo."]}
          style={{ position: "absolute", left: 0, right: 0, top: 56 }}
        />
      ) : null}
      {MEMBERS.map((member, i) => {
        const p = ramp(frame, pull + 4 + i * 3, pull + 20 + i * 3);
        return frame >= pull ? (
          <PhoneAt
            key={member.pose.x}
            pose={{ ...member.pose, x: member.pose.x + member.from * 260 * (1 - p), opacity: p }}
          >
            <SizedDashboard
              tiles={campusWith(booked)}
              place="Kampus Główny"
              arrive={ramp(frame, works + 6 + i * 5, works + 20 + i * 5)}
              pulse={pulse}
            />
          </PhoneAt>
        ) : null;
      })}
      <PhoneAt pose={admin}>
        <Pushed
          screens={[
            {
              at: 0,
              node: (
                <BuildScreen
                  request={REQUEST}
                  stage={frame >= tap + 2 ? "published" : "ready"}
                  built={BUILT_BOOKING}
                  place="Kampus Główny"
                />
              ),
            },
            {
              at: pull,
              node: (
                <SizedDashboard
                  tiles={campusWith(booked)}
                  place="Kampus Główny"
                  arrive={ramp(frame, pull + 8, pull + 22)}
                  pulse={pulse}
                />
              ),
            },
          ]}
        />
        <Tap x={195} y={752} at={tap} />
      </PhoneAt>
      <Ring at={tap + 1} x={PHONE.x} y={PHONE.y + 330} />
    </Light>
  );
};

/* ── 8 · outro: your home, your estate, your city — Twoje Miejsce (shared/finale.tsx) ─────────────────── */

export const OutroScene = () => <Finale tagline="Rośnie razem z Twoimi potrzebami." />;
