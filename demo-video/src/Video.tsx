import React from 'react';
import {fade} from '@remotion/transitions/fade';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {Assistant} from './scenes/Assistant';
import {Generator} from './scenes/Generator';
import {Intro, Outro} from './scenes/Intro';
import {Issue} from './scenes/Issue';
import {Petition} from './scenes/Petition';
import {Problem} from './scenes/Problem';
import {Reveal} from './scenes/Reveal';
import {Verify} from './scenes/Verify';

const SCENES: {C: React.FC; frames: number}[] = [
	{C: Intro, frames: 130},
	{C: Problem, frames: 170},
	{C: Verify, frames: 250},
	{C: Issue, frames: 300},
	{C: Petition, frames: 230},
	{C: Assistant, frames: 330},
	{C: Reveal, frames: 280},
	{C: Generator, frames: 360},
	{C: Outro, frames: 200},
];

const FADE = 15;

export const DURATION = SCENES.reduce((s, x) => s + x.frames, 0) - FADE * (SCENES.length - 1);

export const Video: React.FC = () => (
	<TransitionSeries>
		{SCENES.flatMap(({C, frames}, i) => [
			...(i > 0 ? [<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({durationInFrames: FADE})} />] : []),
			<TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames}>
				<C />
			</TransitionSeries.Sequence>,
		])}
	</TransitionSeries>
);
