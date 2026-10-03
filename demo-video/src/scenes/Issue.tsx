import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {AppFrame, Button, Card, Cursor} from '../components/AppFrame';
import {Stage} from '../components/Stage';
import {C, fadeUp, typed, useIn} from '../theme';
import {Spinner} from './Verify';

const TYPE_AT = 20;
const AI_AT = 75;
const TAGS_AT = 105;
const DUP_AT = 160;
const CLICK = 225;

const DESC = 'Nie świeci latarnia przy ul. Długiej 12, od tygodnia ciemno.';

export const Issue: React.FC = () => {
	const frame = useCurrentFrame();
	const photo = useIn(0);
	const ai = useIn(AI_AT);
	const dup = useIn(DUP_AT);
	const toast = useIn(CLICK + 8);
	const count = frame >= CLICK ? 15 : 14;
	return (
		<Stage caption="Zdjęcie i jedno zdanie. AI kategoryzuje, kieruje do wydziału i łączy duplikaty." captionAt={AI_AT}>
			<AppFrame active="issues">
				<div style={{fontSize: 34, fontWeight: 800, marginBottom: 24}}>Nowe zgłoszenie</div>
				<div style={{display: 'flex', gap: 30}}>
					<Card style={{width: 560, padding: 24, ...fadeUp(photo)}}>
						<LampPhoto />
						<div style={{marginTop: 20, fontSize: 18, color: C.muted, fontWeight: 600}}>Opis</div>
						<div style={{marginTop: 8, minHeight: 72, fontSize: 23, lineHeight: 1.4, padding: '12px 16px', borderRadius: 12, border: `2px solid ${frame < AI_AT ? C.accent : C.line}`}}>
							{typed(DESC, frame, TYPE_AT, 1.3)}
							{frame >= TYPE_AT && frame < AI_AT && Math.floor(frame / 8) % 2 === 0 ? <span style={{color: C.accent}}>|</span> : null}
						</div>
						<div style={{marginTop: 14, fontSize: 18, color: C.muted}}>📍 ul. Długa 12, Kraków · lokalizacja ze zdjęcia</div>
					</Card>

					<div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 22}}>
						{frame >= AI_AT ? (
							<Card style={fadeUp(ai)}>
								<div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 22, fontWeight: 700, color: C.violet}}>
									{frame < TAGS_AT ? <Spinner size={28} color={C.violet} /> : <span>✨</span>}
									{frame < TAGS_AT ? 'AI analizuje zgłoszenie…' : 'AI przeanalizowało zgłoszenie'}
								</div>
								{frame >= TAGS_AT ? (
									<div style={{marginTop: 18, display: 'grid', gridTemplateColumns: '170px 1fr', rowGap: 14, fontSize: 21}}>
										<Tag label="Kategoria" value="💡 Oświetlenie uliczne" delay={TAGS_AT} />
										<Tag label="Trafi do" value="Zarząd Dróg Miasta Krakowa" delay={TAGS_AT + 8} />
										<Tag label="Priorytet" value="Średni · bezpieczeństwo pieszych" delay={TAGS_AT + 16} />
									</div>
								) : null}
							</Card>
						) : null}

						{frame >= DUP_AT ? (
							<Card style={{background: C.amberSoft, border: `2px solid #FCD34D`, ...fadeUp(dup)}}>
								<div style={{fontSize: 22, fontWeight: 800, color: C.amber}}>To samo zgłoszono 2 dni temu, 40 m stąd</div>
								<div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 14}}>
									<div style={{fontSize: 20, flex: 1, lineHeight: 1.4}}>
										#1842 „Ciemno na Długiej przy przystanku”
										<br />
										<b style={{fontSize: 26}}>{count}</b> mieszkańców · status: <b>przyjęte</b>
									</div>
									<Button pressAt={CLICK} color={frame >= CLICK ? C.green : C.amber}>
										{frame >= CLICK ? '✓ Dołączono' : '+1 Dołącz'}
									</Button>
								</div>
							</Card>
						) : null}

						{frame >= CLICK + 8 ? (
							<div style={{alignSelf: 'flex-start', background: C.text, color: 'white', borderRadius: 14, padding: '16px 22px', fontSize: 20, ...fadeUp(toast)}}>
								🔔 Powiadomimy Cię, gdy latarnia zostanie naprawiona.
							</div>
						) : null}
					</div>
				</div>
				<Cursor path={[{at: 0, x: 900, y: 780}, {at: DUP_AT + 20, x: 900, y: 780}, {at: CLICK - 8, x: 1170, y: 470}]} clickAt={CLICK} />
			</AppFrame>
		</Stage>
	);
};

const Tag: React.FC<{label: string; value: string; delay: number}> = ({label, value, delay}) => {
	const p = useIn(delay);
	return (
		<>
			<div style={{color: C.muted, ...fadeUp(p, 8)}}>{label}</div>
			<div style={{fontWeight: 700, ...fadeUp(p, 8)}}>{value}</div>
		</>
	);
};

// Stylised night-street photo of a broken lamp.
const LampPhoto: React.FC = () => {
	const frame = useCurrentFrame();
	const flicker = interpolate(Math.sin(frame / 3) + Math.sin(frame / 7), [-2, 2], [0.05, 0.3]);
	return (
		<svg width="100%" height="300" viewBox="0 0 512 300" style={{borderRadius: 14, display: 'block'}}>
			<rect width="512" height="300" fill="#111827" />
			{Array.from({length: 30}).map((_, i) => (
				<circle key={i} cx={(i * 97) % 512} cy={(i * 53) % 140} r={1.2} fill="#64748B" />
			))}
			<rect x="300" y="120" width="160" height="180" fill="#1F2937" />
			{[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={318 + c * 48} y={140 + r * 50} width="26" height="30" fill={(r + c) % 2 ? '#FDE68A' : '#374151'} opacity={0.8} />))}
			<rect x="0" y="250" width="512" height="50" fill="#374151" />
			<rect x="150" y="70" width="8" height="190" fill="#4B5563" />
			<path d="M154 72 Q154 52 190 52 L215 52" stroke="#4B5563" strokeWidth="8" fill="none" />
			<rect x="200" y="50" width="34" height="14" rx="4" fill="#6B7280" />
			<ellipse cx="217" cy="66" rx="14" ry="5" fill="#FDE68A" opacity={flicker} />
			<polygon points="203,66 231,66 270,250 164,250" fill="#FDE68A" opacity={flicker * 0.25} />
		</svg>
	);
};
