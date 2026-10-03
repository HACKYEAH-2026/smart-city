import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {AppFrame, Card} from '../components/AppFrame';
import {Stage} from '../components/Stage';
import {C, MONO, fadeUp, typed, useIn} from '../theme';
import {highlight} from './Reveal';

const PROMPT = 'Zrób wtyczkę do zgłaszania zepsutych ławek w parkach, z mapą.';
const CODE_AT = 70;
const INSTALLED_AT = 185;
const SWITCH_AT = 215;

const CODE = `export default definePlugin({
  id: "benches",
  permissions: ["storage", "map"],
  views: { main: mapView("benches") },
  tools: {
    report: async (ctx, { park, photo }) =>
      ctx.storage.add("benches", { park, photo }),
  },
});`;

const PINS = [
	{x: 230, y: 180, broken: true, label: 'Park Jordana'},
	{x: 520, y: 300, broken: false, label: ''},
	{x: 700, y: 140, broken: true, label: 'Planty'},
	{x: 860, y: 420, broken: true, label: 'Park Krakowski'},
	{x: 380, y: 470, broken: false, label: ''},
	{x: 990, y: 230, broken: false, label: ''},
];

export const Generator: React.FC = () => {
	const frame = useCurrentFrame();
	return frame < SWITCH_AT ? <Building /> : <Installed />;
};

const Building: React.FC = () => {
	const frame = useCurrentFrame();
	const win = useIn(0);
	const code = useIn(CODE_AT);
	const ok = useIn(INSTALLED_AT, 12);
	const lines = CODE.split('\n');
	const visible = Math.max(0, Math.min(lines.length, Math.floor((frame - CODE_AT - 10) / 9)));
	return (
		<Stage caption="Na żywo: nowa funkcja w kilkadziesiąt sekund, bez zmian w rdzeniu." captionAt={20}>
			<AbsoluteFill style={{flexDirection: 'row', gap: 40, padding: '150px 120px 160px'}}>
				<div style={{width: 640, display: 'flex', flexDirection: 'column', gap: 22, ...fadeUp(win, 30)}}>
					<div style={{fontSize: 22, color: '#93A3C4', fontWeight: 600}}>💬 Agent · Twoje Miejsce (MCP)</div>
					<div style={{alignSelf: 'flex-end', background: C.accent, borderRadius: '22px 22px 6px 22px', padding: '20px 24px', fontSize: 27, lineHeight: 1.4}}>
						{typed(PROMPT, frame, 6, 1.2) || ' '}
					</div>
					{frame >= CODE_AT ? (
						<div style={{fontSize: 24, color: '#CBD5E1', lineHeight: 1.5, ...fadeUp(code, 10)}}>
							Tworzę wtyczkę <b style={{color: 'white'}}>benches</b>: zgłoszenie z parkiem i zdjęciem oraz widok mapy…
						</div>
					) : null}
					{frame >= INSTALLED_AT ? (
						<div style={{alignSelf: 'flex-start', background: 'rgba(21,128,61,0.2)', border: '2px solid #22C55E', color: '#86EFAC', borderRadius: 14, padding: '16px 22px', fontSize: 25, fontWeight: 700, transform: `scale(${0.85 + 0.15 * ok})`, opacity: ok}}>
							✓ Zainstalowano „Ławki” w społeczności Kraków
						</div>
					) : null}
				</div>
				{frame >= CODE_AT ? (
					<div style={{flex: 1, background: '#0F172A', border: `1px solid ${C.nightLine}`, borderRadius: 20, padding: '28px 34px', fontFamily: MONO, fontSize: 24, lineHeight: 1.6, whiteSpace: 'pre', color: '#E2E8F0', alignSelf: 'flex-start', ...fadeUp(code, 30)}}>
						<div style={{fontSize: 16, color: '#64748B', marginBottom: 10}}>plugins/benches/index.ts</div>
						{highlight(lines.slice(0, visible).join('\n'))}
					</div>
				) : null}
			</AbsoluteFill>
		</Stage>
	);
};

const Installed: React.FC = () => {
	const map = useIn(20);
	return (
		<Stage caption="Odświeżamy stronę, a wtyczka już działa dla 12 480 mieszkańców." captionAt={10}>
			<AppFrame active="benches" extra={{item: {id: 'benches', icon: '🪑', label: 'Ławki'}, at: 5}}>
				<div style={{display: 'flex', alignItems: 'center', marginBottom: 22}}>
					<div style={{fontSize: 34, fontWeight: 800}}>🪑 Ławki w parkach</div>
					<div style={{marginLeft: 'auto', background: C.accent, color: 'white', fontWeight: 700, fontSize: 20, padding: '14px 22px', borderRadius: 12}}>+ Zgłoś ławkę</div>
				</div>
				<Card style={{padding: 0, overflow: 'hidden', height: 640, position: 'relative', ...fadeUp(map, 20)}}>
					<svg width="100%" height="100%" viewBox="0 0 1260 640" preserveAspectRatio="xMidYMid slice">
						<rect width="1260" height="640" fill="#EEF2E6" />
						<path d="M0 360 C300 300 500 420 1260 330" stroke="#BFDBFE" strokeWidth="46" fill="none" />
						<ellipse cx="260" cy="190" rx="150" ry="90" fill="#BBF7D0" />
						<ellipse cx="720" cy="150" rx="190" ry="60" fill="#BBF7D0" />
						<ellipse cx="880" cy="450" rx="160" ry="100" fill="#BBF7D0" />
						{[120, 470, 1050].map((x) => (
							<line key={x} x1={x} y1={0} x2={x + 60} y2={640} stroke="white" strokeWidth={14} />
						))}
						{[90, 560].map((y) => (
							<line key={y} x1={0} y1={y} x2={1260} y2={y - 40} stroke="white" strokeWidth={14} />
						))}
					</svg>
					{PINS.map((p, i) => (
						<Pin key={i} {...p} delay={30 + i * 7} />
					))}
				</Card>
			</AppFrame>
		</Stage>
	);
};

const Pin: React.FC<{x: number; y: number; broken: boolean; label: string; delay: number}> = ({x, y, broken, label, delay}) => {
	const p = useIn(delay, 10);
	return (
		<div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -100%) scale(${p})`, transformOrigin: 'bottom center', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
			{label ? <div style={{background: 'white', borderRadius: 8, padding: '5px 10px', fontSize: 16, fontWeight: 600, marginBottom: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'}}>{label}</div> : null}
			<div style={{width: 44, height: 44, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: broken ? C.red : C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.25)'}}>
				<span style={{transform: 'rotate(45deg)', fontSize: 20}}>{broken ? '⚠️' : '🪑'}</span>
			</div>
		</div>
	);
};
