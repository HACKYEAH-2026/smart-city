import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BrandMark, colors } from "../../app-ui";
import { FONT, Headline, ramp, rise, useCue, useSpring } from "./kit";
import { mediaUrl } from "./media";
import { Center, CityMap, ClipVideo, NIGHT } from "./stage";

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
  if (frame < at || frame >= until) return null;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill>
        {clip ? (
          <ClipVideo id={id} from={shot.from} at={at} until={until} />
        ) : id === "miasto" ? (
          <AbsoluteFill style={{ background: colors.background }}>
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
          variant="snap"
          size={170}
          align="center"
          style={{ color: "#FFFFFF", textShadow: "0 6px 40px rgba(0,0,0,0.45)" }}
        />
      </Center>
    </AbsoluteFill>
  );
};

/**
 * The ads' finale, on the narration „Twój dom. Twoje osiedle. Twoje miasto. Twoje Miejsce.”: a home, a housing
 * estate and a city from the air, one line each, then the brand on red with the ad's own `tagline`.
 */
export const Finale = ({ tagline }: { tagline: string }) => {
  const frame = useCurrentFrame();
  const estate = useCue("twoje", 0);
  const city = useCue("twoje", 1);
  const place = useCue("twoje", 2);
  const name = useCue("miejsce");
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      <Shot id="dom" at={0} until={estate} />
      <Shot id="osiedle" at={estate} until={city} />
      <Shot id="miasto" at={city} until={place} />
      {frame >= place ? (
        <AbsoluteFill style={{ background: colors.primary }}>
          <Center style={{ gap: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
              <BrandMark size={170} color="onPrimary" />
              <Headline text="Twoje Miejsce" at={place} spoken variant="snap" size={150} style={{ color: "#FFFFFF" }} />
            </div>
            <Headline
              text={tagline}
              at={name + 14}
              spoken
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
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
