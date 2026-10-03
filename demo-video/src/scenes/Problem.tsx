import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../components/Stage';
import {C, fadeUp, useIn} from '../theme';

const POSTS = [
	{who: 'user_88231', avatar: '🤖', text: 'Ktoś wie, czy ktoś zgłaszał latarnię na Długiej? Od tygodnia nie świeci', meta: '47 komentarzy · nikt nie wie'},
	{who: 'Okazja Dnia', avatar: '💸', text: 'TANIE MIESZKANIA KRAKÓW!!! kliknij link w bio 👉👉', meta: 'Sponsorowane?'},
	{who: 'Konto bez zdjęcia', avatar: '👤', text: 'Głosujcie na projekt nr 12 w budżecie obywatelskim, mam 30 kont 😉', meta: '3 godz.'},
];

const STAMPS = [
	{text: 'Boty i spam', x: 1200, y: 250, rot: -6},
	{text: 'Kto tu naprawdę mieszka?', x: 1150, y: 470, rot: 4},
	{text: 'Zgłoszenia giną w komentarzach', x: 1110, y: 690, rot: -3},
];

export const Problem: React.FC = () => {
	return (
		<Stage caption="Dziś lokalne sprawy toczą się w grupach, w których nie wiadomo, kto jest kim." captionAt={70}>
			<AbsoluteFill>
				<div style={{position: 'absolute', left: 170, top: 90, fontSize: 30, color: '#93A3C4', ...fadeUp(useIn(0))}}>
					Grupa „Kraków – sąsiedzi” · 48 tys. członków
				</div>
				{POSTS.map((p, i) => (
					<Post key={p.who} {...p} delay={8 + i * 12} top={160 + i * 225} />
				))}
				{STAMPS.map((s, i) => (
					<Stamp key={s.text} {...s} delay={45 + i * 15} />
				))}
			</AbsoluteFill>
		</Stage>
	);
};

const Post: React.FC<{who: string; avatar: string; text: string; meta: string; delay: number; top: number}> = ({who, avatar, text, meta, delay, top}) => {
	const p = useIn(delay);
	return (
		<div style={{position: 'absolute', left: 170, top, width: 900, background: '#E5E7EB', color: '#1F2937', borderRadius: 18, padding: '24px 30px', filter: 'saturate(0.4)', ...fadeUp(p, 40)}}>
			<div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10}}>
				<div style={{width: 46, height: 46, borderRadius: 23, background: '#D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26}}>{avatar}</div>
				<div style={{fontSize: 22, fontWeight: 700}}>{who}</div>
			</div>
			<div style={{fontSize: 26, lineHeight: 1.35}}>{text}</div>
			<div style={{fontSize: 18, color: '#6B7280', marginTop: 10}}>{meta}</div>
		</div>
	);
};

const Stamp: React.FC<{text: string; x: number; y: number; rot: number; delay: number}> = ({text, x, y, rot, delay}) => {
	const p = useIn(delay, 11);
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: y,
				padding: '14px 26px',
				border: `4px solid ${C.red}`,
				color: '#FCA5A5',
				background: 'rgba(220,38,38,0.12)',
				borderRadius: 12,
				fontSize: 34,
				fontWeight: 800,
				textTransform: 'uppercase',
				letterSpacing: 1,
				opacity: p,
				transform: `rotate(${rot}deg) scale(${1.6 - 0.6 * p})`,
			}}
		>
			{text}
		</div>
	);
};
