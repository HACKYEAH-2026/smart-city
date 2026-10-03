import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { AppFrame, Button, Card, Cursor } from "../components/AppFrame";
import { Stage } from "../components/Stage";
import { C, fadeUp, useIn } from "../theme";

const CLICK = 70;
const RUSH_END = 150;
const GOAL = 300;

export const Petition: React.FC = () => {
  const frame = useCurrentFrame();
  const card = useIn(0);
  const signatures = Math.round(
    interpolate(frame, [0, CLICK, CLICK + 2, RUSH_END], [287, 287, 288, GOAL], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const done = signatures >= GOAL;
  const doneIn = useIn(RUSH_END, 12);
  const signers = Math.max(0, signatures - 284);
  return (
    <Stage
      caption="Podpisy pod inicjatywą uchwałodawczą: zweryfikowane i policzalne, bez PESEL-u na papierowej liście."
      captionAt={30}
    >
      <AppFrame active="petitions">
        <div style={{ display: "flex", gap: 30 }}>
          <Card style={{ flex: 1, padding: 40, ...fadeUp(card) }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: C.accent,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Obywatelska inicjatywa uchwałodawcza
            </div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 800,
                marginTop: 12,
                lineHeight: 1.2,
              }}
            >
              Zielone podwórka na Grzegórzkach
            </div>
            <div
              style={{
                fontSize: 22,
                color: C.muted,
                marginTop: 14,
                lineHeight: 1.45,
              }}
            >
              Projekt uchwały o zamianie 6 betonowych podwórek w ogrody społeczne. Potrzeba {GOAL} podpisów
              użytkowników, żeby trafił pod obrady Rady Miasta.
            </div>
            <div
              style={{
                marginTop: 34,
                display: "flex",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  color: done ? C.green : C.text,
                }}
              >
                {signatures}
              </span>
              <span style={{ fontSize: 26, color: C.muted }}>/ {GOAL} podpisów</span>
            </div>
            <div
              style={{
                marginTop: 14,
                height: 22,
                borderRadius: 11,
                background: C.canvas,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(signatures / GOAL) * 100}%`,
                  borderRadius: 11,
                  background: done ? C.green : C.accent,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 34,
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              {frame < CLICK ? (
                <Button pressAt={CLICK}>🪪 Podpisz przez mObywatel</Button>
              ) : (
                <Button color={C.green}>✓ Podpisano jako mieszkanka Krakowa</Button>
              )}
            </div>
            {done ? (
              <div
                style={{
                  marginTop: 26,
                  padding: "18px 22px",
                  borderRadius: 14,
                  background: C.greenSoft,
                  color: C.green,
                  fontSize: 24,
                  fontWeight: 700,
                  ...fadeUp(doneIn),
                }}
              >
                🎉 Próg osiągnięty! Projekt został złożony w Radzie Miasta.
              </div>
            ) : null}
          </Card>
          <Card style={{ width: 440, ...fadeUp(useIn(10)) }}>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Ostatnie podpisy</div>
            {Array.from({ length: Math.min(signers, 9) }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: newest-first rows keyed by signer number
                key={signers - i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 0",
                  borderBottom: `1px solid ${C.line}`,
                  fontSize: 18,
                }}
              >
                <span style={{ color: C.green, fontWeight: 800 }}>✓</span>
                <span style={{ whiteSpace: "nowrap" }}>Zweryfikowany mieszkaniec</span>
                <span style={{ marginLeft: "auto", color: C.muted }}>{i === 0 ? "teraz" : `${i * 2} min`}</span>
              </div>
            ))}
            <div
              style={{
                marginTop: 14,
                fontSize: 16,
                color: C.muted,
                lineHeight: 1.4,
              }}
            >
              Komitet widzi liczbę i ważność podpisów, nie dane osobowe.
            </div>
          </Card>
        </div>
        <Cursor
          path={[
            { at: 0, x: 700, y: 760 },
            { at: CLICK - 10, x: 260, y: 545 },
            { at: CLICK + 20, x: 260, y: 545 },
            { at: CLICK + 50, x: 700, y: 760 },
          ]}
          clickAt={CLICK}
        />
      </AppFrame>
    </Stage>
  );
};
