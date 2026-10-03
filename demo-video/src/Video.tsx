import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type React from "react";
import { Assistant } from "./scenes/Assistant";
import { Generator } from "./scenes/Generator";
import { Intro, Outro } from "./scenes/Intro";
import { Issue } from "./scenes/Issue";
import { Petition } from "./scenes/Petition";
import { Problem } from "./scenes/Problem";
import { Reveal } from "./scenes/Reveal";
import { Verify } from "./scenes/Verify";

const SCENES: { id: string; C: React.FC; frames: number }[] = [
  { id: "intro", C: Intro, frames: 130 },
  { id: "problem", C: Problem, frames: 170 },
  { id: "verify", C: Verify, frames: 250 },
  { id: "issue", C: Issue, frames: 300 },
  { id: "petition", C: Petition, frames: 230 },
  { id: "assistant", C: Assistant, frames: 330 },
  { id: "reveal", C: Reveal, frames: 280 },
  { id: "generator", C: Generator, frames: 360 },
  { id: "outro", C: Outro, frames: 200 },
];

const FADE = 15;

export const DURATION = SCENES.reduce((s, x) => s + x.frames, 0) - FADE * (SCENES.length - 1);

export const Video: React.FC = () => (
  <TransitionSeries>
    {SCENES.flatMap(({ id, C, frames }, i) => [
      ...(i > 0
        ? [
            <TransitionSeries.Transition
              key={`fade-${id}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: FADE })}
            />,
          ]
        : []),
      <TransitionSeries.Sequence key={id} durationInFrames={frames}>
        <C />
      </TransitionSeries.Sequence>,
    ])}
  </TransitionSeries>
);
