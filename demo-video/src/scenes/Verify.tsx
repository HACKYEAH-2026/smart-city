import type React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { AppFrame, Button, Card, Cursor } from '../components/AppFrame';
import { Stage } from '../components/Stage';
import { C, fadeUp, useIn } from '../theme';

const CLICK = 55;
const CONNECT = 70;
const CONSENT = 115;
const DONE = 185;

export const Verify: React.FC = () => {
  const frame = useCurrentFrame();
  const modal = useIn(CONNECT);
  const consent = useIn(CONSENT);
  const done = useIn(DONE, 12);
  return (
    <Stage
      caption='Dołączają tylko mieszkańcy. Platforma dostaje jeden fakt: „mieszka w gminie Kraków”.'
      captionAt={CONSENT}
    >
      <AppFrame active='feed' verified={frame >= DONE}>
        <div
          style={{ display: 'flex', justifyContent: 'center', paddingTop: 70 }}
        >
          <Card style={{ width: 720, textAlign: 'center', padding: 50 }}>
            <div style={{ fontSize: 60 }}>🏙️</div>
            <div style={{ fontSize: 40, fontWeight: 800, marginTop: 10 }}>
              Dołącz do społeczności Kraków
            </div>
            <div
              style={{
                fontSize: 23,
                color: C.muted,
                marginTop: 14,
                lineHeight: 1.4,
              }}
            >
              Ta społeczność jest tylko dla użytkowników gminy Kraków.
              <br />
              Potwierdź to jednym kliknięciem.
            </div>
            <div style={{ marginTop: 36 }}>
              <Button pressAt={CLICK}>🪪 Zweryfikuj przez mObywatel</Button>
            </div>
          </Card>
        </div>
        <Cursor
          path={[
            { at: 0, x: 1100, y: 700 },
            { at: CLICK - 8, x: 640, y: 525 },
          ]}
          clickAt={CLICK}
        />

        {frame >= CONNECT ? (
          <AbsoluteFill
            style={{
              background: `rgba(15,23,42,${0.45 * modal})`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Card style={{ width: 640, padding: 44, ...fadeUp(modal, 40) }}>
              {frame < CONSENT ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 22,
                    fontSize: 26,
                    fontWeight: 600,
                  }}
                >
                  <Spinner />
                  Łączenie z mObywatelem…
                </div>
              ) : frame < DONE ? (
                <div style={fadeUp(consent)}>
                  <div
                    style={{ fontSize: 28, fontWeight: 800, marginBottom: 22 }}
                  >
                    Twoje Miejsce prosi o:
                  </div>
                  <Row
                    ok
                    text='Potwierdzenie: mieszkaniec gminy Kraków'
                    delay={CONSENT + 8}
                  />
                  <Row text='PESEL' delay={CONSENT + 18} />
                  <Row text='Adres zamieszkania' delay={CONSENT + 26} />
                  <Row text='Data urodzenia' delay={CONSENT + 34} />
                  <div style={{ marginTop: 26 }}>
                    <Button pressAt={DONE - 10} color={C.green}>
                      Udostępnij
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    transform: `scale(${0.8 + 0.2 * done})`,
                    opacity: done,
                  }}
                >
                  <div
                    style={{
                      width: 110,
                      height: 110,
                      borderRadius: 55,
                      background: C.greenSoft,
                      color: C.green,
                      fontSize: 64,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ✓
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, marginTop: 20 }}>
                    Witaj, sąsiadko!
                  </div>
                  <div
                    style={{
                      fontSize: 23,
                      color: C.green,
                      fontWeight: 600,
                      marginTop: 8,
                    }}
                  >
                    Zweryfikowana mieszkanka Krakowa
                  </div>
                </div>
              )}
            </Card>
          </AbsoluteFill>
        ) : null}
      </AppFrame>
    </Stage>
  );
};

const Row: React.FC<{ text: string; ok?: boolean; delay: number }> = ({
  text,
  ok,
  delay,
}) => {
  const p = useIn(delay);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontSize: 23,
        padding: '9px 0',
        ...fadeUp(p, 10),
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          background: ok ? C.greenSoft : C.redSoft,
          color: ok ? C.green : C.red,
        }}
      >
        {ok ? '✓' : '✕'}
      </span>
      <span
        style={{
          color: ok ? C.text : C.muted,
          textDecoration: ok ? undefined : 'line-through',
          fontWeight: ok ? 600 : 400,
        }}
      >
        {text}
      </span>
      {!ok ? (
        <span style={{ marginLeft: 'auto', fontSize: 17, color: C.muted }}>
          nie udostępniamy
        </span>
      ) : null}
    </div>
  );
};

export const Spinner: React.FC<{ size?: number; color?: string }> = ({
  size = 36,
  color = C.accent,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `4px solid ${C.line}`,
        borderTopColor: color,
        transform: `rotate(${interpolate(frame, [0, 30], [0, 360])}deg)`,
      }}
    />
  );
};
