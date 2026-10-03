import { t } from "@app/app/src/texts";
import { Building2, GraduationCap, Landmark, Sparkles } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BrandMark, colors, Icon } from "../../app-ui";
import { BOOKING_CODE, Checks, CodePanel } from "../shared/builder";
import { Eyebrow, FONT, Headline, keys, rise, Tap, typed, useCue, useScene } from "../shared/kit";
import type { MediaId } from "../shared/media";
import {
  announcementsWidget,
  BUILT_BOOKING,
  BuildScreen,
  type BuildStage,
  bookingFormView,
  bookingListView,
  bookingScheduleView,
  bookingWidget,
  budgetView,
  budgetVotedView,
  budgetWidget,
  DashboardScreen,
  detailView,
  IssueFormScreen,
  issuesWidget,
  ManageScreen,
  mergeView,
  PluginScreen,
  PreviewScreen,
  ScannerScreen,
} from "../shared/screens";
import { Center, ClipVideo, Counter, Flash, Light, NIGHT, PhoneAt, Pop, Pushed, WhiteIcon } from "../shared/stage";

/** Where the phone stands in the split scenes, and the text column to its left. */
const PHONE = { x: 1290, y: 545, rotY: -10 };
const REQUEST = "Rezerwacja sal: studenci wybierają salę i godzinę, a dziekanat widzi grafik wszystkich sal.";

/** The shot a community's scene opens on: its clip, full frame, with its name. */
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

/* ── 1 · intro: a city, a campus, a housing cooperative — each needs something else ─────────────────── */

const TRIO = [
  { id: "miasto", label: "Miasto", cue: "miasto", from: 1 },
  { id: "kampus", label: "Uczelnia", cue: "uczelnia", from: 0 },
  { id: "spoldzielnia", label: "Spółdzielnia", cue: "spółdzielnia", from: 1 },
] as const;

/** The campus clip runs into its sequel (kampus-qr opens on its frame at 6.5 s): the student walks to a QR code. */
const CAMPUS_HANDOFF = 6.5;
const QR_SPAN = 7.4;

const IntroPanel = ({ id, label, cue, from, grow, dim }: (typeof TRIO)[number] & { grow: number; dim: number }) => {
  const frame = useCurrentFrame();
  const { duration } = useScene();
  const at = useCue(cue);
  const middle = id === "kampus";
  // The campus clip plays at its own pace and hands over to its sequel on their shared frame.
  const handoff = at + CAMPUS_HANDOFF * 30;
  const flex = middle ? 1 + 2 * grow : 1 - grow;
  if (frame < at) return <div style={{ flex }} />;
  return (
    <div style={{ flex, position: "relative", overflow: "hidden" }}>
      {middle && frame >= handoff ? (
        <ClipVideo id="kampus-qr" from={0} at={handoff} until={duration} span={QR_SPAN} />
      ) : (
        <ClipVideo id={id} from={from} at={at} until={middle ? handoff : duration} />
      )}
      <AbsoluteFill
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0) 45%)", opacity: 1 - grow }}
      />
      <AbsoluteFill style={{ background: "rgba(10,10,12,0.6)", opacity: dim }} />
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
 * Three communities side by side. With „Każda społeczność…” the campus opens up to the whole frame, the line stays
 * on it to its end, then its student walks to a QR code and scans it: the next scene cuts to the app's scanner.
 */
export const IntroScene = () => {
  const frame = useCurrentFrame();
  const scene = useScene();
  const each = useCue("każda");
  const end = scene.words.at(-1)?.to ?? 0;
  const expandAt = each + 24;
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
          <IntroPanel key={panel.id} {...panel} grow={grow} dim={dim} />
        ))}
      </div>
      {frame >= each ? (
        <Center style={{ opacity: 1 - lineOut }}>
          <Headline
            text={"Każda społeczność\npotrzebuje innych narzędzi."}
            at={each}
            spoken
            variant="snap"
            size={96}
            align="center"
            accent={["innych"]}
            style={{ color: "#FFFFFF", textShadow: "0 6px 40px rgba(0,0,0,0.5)" }}
          />
        </Center>
      ) : null}
    </AbsoluteFill>
  );
};

/* ── 2 · promise: one app that fits each place ──────────────────────────────────────────────────────── */

const PLACES = [
  {
    key: "city",
    place: "Kraków",
    label: "Miasto",
    icon: Landmark,
    x: 520,
    widgets: [budgetWidget(), issuesWidget(3)],
  },
  {
    key: "campus",
    place: "Kampus Główny",
    label: "Uczelnia",
    icon: GraduationCap,
    x: 960,
    widgets: [bookingWidget(), announcementsWidget("Biblioteka otwarta do 22:00 w czasie sesji")],
  },
  {
    key: "coop",
    place: "Spółdzielnia Słoneczna",
    label: "Spółdzielnia",
    icon: Building2,
    x: 1400,
    widgets: [issuesWidget(3), announcementsWidget("Przegląd instalacji gazowej w czwartek")],
  },
] as const;

/** Picked up from the intro's last shot: the student's scan, now in the app — the campus, joined, its dashboard. */
const CampusJoin = () => {
  const frame = useCurrentFrame();
  const name = useCue("twoje");
  const one = useCue("jedna");
  const lock = 8;
  const preview = lock + 6;
  const join = one + 22;
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
        <Headline
          text={"Jedna aplikacja,\ndopasowana do miejsca."}
          at={one - 2}
          spoken
          variant="snap"
          size={88}
          accent={["dopasowana"]}
        />
      </Column>
      <PhoneAt pose={PHONE} dark={frame < preview}>
        <Pushed
          screens={[
            { at: 0, node: <ScannerScreen seen={1} line={frame < lock ? (Math.sin(frame / 3) + 1) / 2 : 0.5} /> },
            { at: preview, node: <PreviewScreen place="Kampus Główny" address="" code="KMP-GLW" /> },
            {
              at: join + 6,
              node: (
                <DashboardScreen
                  place="Kampus Główny"
                  widgets={[bookingWidget(), announcementsWidget("Biblioteka otwarta do 22:00 w czasie sesji")]}
                />
              ),
            },
          ]}
        />
        <Flash at={lock} />
        <Tap x={195} y={751} at={join} />
      </PhoneAt>
    </Light>
  );
};

export const PromiseScene = () => {
  const frame = useCurrentFrame();
  const _one = useCue("jedna");
  const each = useCue("każde");
  if (frame < each - 2) return <CampusJoin />;
  return (
    <Light drift={0.8}>
      <Headline
        text={"Każde miejsce po swojemu."}
        at={each - 2}
        spoken
        variant="snap"
        size={72}
        align="center"
        accent={["swojemu."]}
        style={{ position: "absolute", left: 0, right: 0, top: 60 }}
      />
      {PLACES.map((p, i) => (
        <div key={p.key}>
          <PhoneAt pose={{ x: p.x, y: 660, scale: 0.68 }}>
            <DashboardScreen place={p.place} widgets={[...p.widgets]} />
          </PhoneAt>
          <div style={{ position: "absolute", left: p.x, top: 990, transform: "translateX(-50%)" }}>
            <Pop at={each + i * 6} style={{ background: "#FFFFFF", color: colors.text }}>
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

/* ── 3 · city: a civic budget — residents vote, the results show on the dashboard ──────────────────── */

export const CityScene = () => {
  const frame = useCurrentFrame();
  const budget = useCue("budżet");
  const vote = useCue("głosują");
  const results = useCue("wyniki");
  const board = useCue("pulpicie");
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
        <div
          style={{
            fontFamily: FONT.semibold,
            fontSize: 40,
            color: colors.textSecondary,
            ...rise(
              keys(frame, [
                [results - 4, 0],
                [results + 8, 1],
              ]),
              16,
            ),
          }}
        >
          Wyniki od razu na pulpicie.
        </div>
      </Column>
      <PhoneAt pose={PHONE}>
        <Pushed
          screens={[
            { at: 0, node: <PluginScreen node={frame >= vote + 4 ? budgetVotedView() : budgetView()} /> },
            { at: board, node: <DashboardScreen widgets={[budgetWidget(), issuesWidget(3)]} /> },
          ]}
        />
        <Tap x={195} y={399} at={vote} />
      </PhoneAt>
    </Light>
  );
};

/* ── 4 · campus: room booking — a student books, the dean's office sees the schedule ──────────────── */

export const CampusScene = () => {
  const frame = useCurrentFrame();
  const booking = useCue("rezerwację");
  const room = useCue("salę");
  const hour = useCue("godzinę");
  const office = useCue("dziekanat");
  const form = room + 4;
  const book = office - 10;
  if (frame < booking - 2) return <Establishing id="kampus" from={4} label="Uczelnia" until={booking - 2} />;
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
          <DashboardScreen place="Kampus Główny" widgets={[bookingWidget()]} />
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
            { at: 0, node: <PluginScreen node={bookingListView()} /> },
            {
              at: form,
              node: (
                <PluginScreen
                  // A new tree per pick: the renderer's form takes its values from the tree when it mounts.
                  key={frame >= hour + 2 ? "picked" : "empty"}
                  node={bookingFormView(frame >= hour + 2 ? "12:00" : "")}
                />
              ),
            },
          ]}
        />
        <Tap x={195} y={552} at={room} />
        <Tap x={212} y={349} at={hour} />
        <Tap x={195} y={462} at={book} />
      </PhoneAt>
    </Light>
  );
};

/* ── 5 · housing cooperative: issue reports with a photo, duplicates merged by the AI ─────────────── */

export const CoopScene = () => {
  const frame = useCurrentFrame();
  const reports = useCue("zgłoszenia");
  const photo = useCue("zdjęciem");
  const ai = useCue("ai");
  const same = useCue("problemu");
  const merge = ai - 2;
  const joined = same - 6;
  if (frame < reports - 2) return <Establishing id="spoldzielnia" from={1} label="Spółdzielnia" until={reports - 2} />;
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
          AI łączy te same zgłoszenia
        </Pop>
        {frame >= joined + 8 ? <Counter at={joined + 8} /> : null}
      </Column>
      <PhoneAt pose={PHONE}>
        <Pushed
          screens={[
            {
              at: 0,
              node: (
                <IssueFormScreen
                  title={typed("Latarnia przy przystanku nie działa", frame, photo + 4, 2.4)}
                  category={frame >= photo + 4 ? "Oświetlenie" : "Inne"}
                  withPhoto={frame >= photo + 2}
                  scroll={keys(frame, [
                    [merge - 16, 0],
                    [merge - 8, 420],
                  ])}
                />
              ),
            },
            { at: merge, node: <PluginScreen node={mergeView()} /> },
            {
              at: joined + 6,
              node: (
                <PluginScreen
                  node={detailView({ support: frame >= joined + 10 ? 4 : 3, status: "open", admin: false })}
                />
              ),
            },
          ]}
        />
        <Tap x={67} y={247} at={photo} />
        <Tap x={195} y={549} at={merge - 4} />
        <Tap x={195} y={739} at={joined} />
      </PhoneAt>
    </Light>
  );
};

/* ── 6 · builder: what is missing, described in the app; the AI writes it and checks it ───────────── */

export const BuilderScene = () => {
  const frame = useCurrentFrame();
  const { duration } = useScene();
  const missing = useCue("czegoś");
  const admin = useCue("administrator");
  const describes = useCue("opisuje");
  const ai = useCue("ai");
  const checks = useCue("sprawdza");
  const ready = duration - 22;
  const create = ai - 4;
  const stage: BuildStage = frame >= ready ? "ready" : frame >= create ? "working" : "typing";
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
            at={describes}
            spoken
            variant="snap"
            size={100}
            accent={["własnymi"]}
          />
        </Column>
      ) : frame < ready ? (
        <div style={{ position: "absolute", left: 120, top: 150, display: "flex", flexDirection: "column", gap: 30 }}>
          <CodePanel at={ai} code={BOOKING_CODE} file="sale/index.ts" />
          <Checks from={checks - 6} to={ready - 4} />
        </div>
      ) : (
        <Column>
          <Headline text={"Rozszerzenie\ngotowe."} at={ready} variant="snap" size={110} accent={["gotowe."]} />
        </Column>
      )}
      <PhoneAt pose={PHONE}>
        <Pushed
          screens={[
            { at: 0, node: <ManageScreen /> },
            {
              at: describes - 2,
              node: (
                <BuildScreen
                  request={typed(REQUEST, frame, describes + 6, 2.4)}
                  stage={stage}
                  attempt={frame >= checks + 10 ? 1 : 0}
                  built={BUILT_BOOKING}
                />
              ),
            },
          ]}
        />
        <Tap x={195} y={717} at={describes - 8} />
        <Tap x={195} y={461} at={create - 2} />
      </PhoneAt>
    </Light>
  );
};

/* ── 7 · outro: the brand and its line ──────────────────────────────────────────────────────────────── */

export const OutroScene = () => {
  const frame = useCurrentFrame();
  const name = useCue("twoje");
  const line = useCue("miarę");
  return (
    <AbsoluteFill style={{ background: colors.primary }}>
      <Center style={{ gap: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
          <BrandMark size={170} color="onPrimary" />
          <Headline text="Twoje Miejsce" at={name} spoken variant="snap" size={150} style={{ color: "#FFFFFF" }} />
        </div>
        <Headline
          text="Na miarę Twojej społeczności."
          at={line - 4}
          spoken
          variant="snap"
          size={64}
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
            ...rise(
              keys(frame, [
                [line + 40, 0],
                [line + 56, 1],
              ]),
              16,
            ),
          }}
        >
          HackYeah 2026 · Smart City
        </div>
      </Center>
    </AbsoluteFill>
  );
};
