import { t } from "@app/app/src/texts";
import { Building2, GraduationCap, Landmark, Sparkles } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BrandMark, colors, Icon } from "../../app-ui";
import { BOOKING_CODE, Checks, CodePanel } from "../shared/builder";
import { Finale } from "../shared/finale";
import { Eyebrow, FONT, Headline, keys, rise, Tap, typed, useCue, useScene } from "../shared/kit";
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
  budgetView,
  budgetWidget,
  COOP_ISSUE,
  DashboardScreen,
  discussionsWidget,
  IssueFormScreen,
  issueFormView,
  issuesWidget,
  joinedView,
  mergeView,
  PluginScreen,
  PreviewScreen,
  REPORTERS,
  ScannerScreen,
} from "../shared/screens";
import { Center, ClipVideo, Counter, Flash, Light, NIGHT, PhoneAt, Pop, Pushed, WhiteIcon } from "../shared/stage";

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

/** A line under the headline, rising in at `at`. */
const Sub = ({ at, children }: { at: number; children: ReactNode }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONT.semibold,
        fontSize: 40,
        color: colors.textSecondary,
        ...rise(
          keys(frame, [
            [at - 4, 0],
            [at + 8, 1],
          ]),
          16,
        ),
      }}
    >
      {children}
    </div>
  );
};

/* ── 1 · intro: a city, a campus, a housing cooperative — each has its own needs ────────────────────── */

const TRIO = [
  { id: "miasto", label: "Miasto", cue: "miasto", from: 1 },
  { id: "kampus", label: "Uczelnia", cue: "uczelnia", from: 0 },
  { id: "spoldzielnia", label: "Spółdzielnia", cue: "spółdzielnia", from: 1 },
] as const;

/** Where the campus panel cuts to the QR clip: she is at the poster, about to raise her phone to its code. */
const QR_FROM = 4;
/** The QR clip's second her phone is up against the code: the scene ends there and the app's scanner takes over. */
const QR_SCAN = 7.4;

const IntroPanel = ({
  id,
  label,
  cue,
  from,
  grow,
  dim,
  handoff,
}: (typeof TRIO)[number] & { grow: number; dim: number; handoff: number }) => {
  const frame = useCurrentFrame();
  const { duration } = useScene();
  const at = useCue(cue);
  const middle = id === "kampus";
  const flex = middle ? 1 + 2 * grow : 1 - grow;
  if (frame < at) return <div style={{ flex }} />;
  return (
    <div style={{ flex, position: "relative", overflow: "hidden" }}>
      {middle && frame >= handoff ? (
        <ClipVideo id="kampus-qr" from={QR_FROM} at={handoff} until={duration} span={QR_SCAN - QR_FROM} />
      ) : (
        <ClipVideo id={id} from={from} at={at} until={middle ? handoff : duration} />
      )}
      <AbsoluteFill
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0) 45%)", opacity: 1 - grow }}
      />
      <AbsoluteFill style={{ background: "rgba(10,10,12,0.55)", opacity: dim }} />
      <Headline
        text={label}
        at={at}
        variant="snap"
        size={64}
        style={{ position: "absolute", left: 44, bottom: 48, color: "#FFFFFF", opacity: 1 - grow }}
      />
    </div>
  );
};

/**
 * Three communities side by side, each as the narrator names it. With „Każda społeczność…” the line comes up over
 * them and the campus opens up to the whole frame; its student reaches a QR code and raises her phone to it: the
 * next scene is the app's scanner.
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
        {TRIO.map((panel) => (
          <IntroPanel key={panel.id} {...panel} grow={grow} dim={dim} handoff={handoff} />
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
    widgets: [budgetWidget(), issuesWidget(REPORTERS)],
  },
  { key: "campus", place: "Kampus Główny", label: "Uczelnia", icon: GraduationCap, x: 960, widgets: CAMPUS_WIDGETS },
  {
    key: "coop",
    place: "Spółdzielnia Słoneczna",
    label: "Spółdzielnia",
    icon: Building2,
    x: 1400,
    widgets: [issuesWidget(REPORTERS, "open", COOP_ISSUE), discussionsWidget()],
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
          <PhoneAt pose={{ x: p.x, y: 660, scale: 0.68 }}>
            <DashboardScreen place={p.place} widgets={[...p.widgets]} />
          </PhoneAt>
          <div style={{ position: "absolute", left: p.x, top: 990, transform: "translateX(-50%)" }}>
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

/* ── 3 · city: a civic budget — residents vote in the app ─────────────────────────────────────────── */

export const CityScene = () => {
  const frame = useCurrentFrame();
  const budget = useCue("budżet");
  const vote = useCue("głosują");
  const voted = frame >= vote + 4;
  if (frame < budget - 2) return <Establishing id="miasto" from={1} label="Miasto" until={budget - 2} />;
  return (
    <Light drift={0.6}>
      <Column>
        <Eyebrow>Miasto</Eyebrow>
        <Headline
          text={"Budżet\nobywatelski."}
          at={budget - 2}
          spoken
          variant="snap"
          size={110}
          accent={["obywatelski."]}
        />
        <Sub at={vote}>Głosowanie w aplikacji.</Sub>
      </Column>
      <PhoneAt pose={PHONE}>
        <PluginScreen node={budgetView(voted)} toast={voted ? "Dziękujemy za głos!" : undefined} />
        <Tap x={318} y={330} at={vote} />
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
        <PhoneAt pose={{ x: 690, y: 640, scale: 0.8, rotY: 18 }}>
          <PluginScreen node={bookingDoneView()} />
        </PhoneAt>
        <PhoneAt pose={{ x: 1230, y: 640, scale: 0.8, rotY: -18 }}>
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

/* ── 7 · outro: your home, your estate, your city — Twoje Miejsce (shared/finale.tsx) ─────────────────── */

export const OutroScene = () => <Finale tagline="Rośnie razem z Twoimi potrzebami." />;
