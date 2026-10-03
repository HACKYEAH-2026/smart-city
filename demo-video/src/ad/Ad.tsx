import type { ComponentType } from "react";
import { Sequence } from "remotion";
import "../app-ui";
import { Captions, SceneProvider } from "./kit";
import {
  BuilderScene,
  CityScene,
  JoinScene,
  OpenScene,
  OutroScene,
  ProblemScene,
  ReportScene,
  RevealScene,
} from "./scenes";
import type { BeatId } from "./script";
import { SCENES } from "./timing";

const SCENE: Record<BeatId, ComponentType> = {
  open: OpenScene,
  problem: ProblemScene,
  reveal: RevealScene,
  join: JoinScene,
  report: ReportScene,
  city: CityScene,
  builder: BuilderScene,
  outro: OutroScene,
};

export type AdProps = { captions: boolean };

/** The ad (Reklama): one scene per narration beat, timed by timing.ts; `captions` shows the narration as text. */
export const Ad = ({ captions }: AdProps) => (
  <>
    {SCENES.map((scene) => {
      const Scene = SCENE[scene.id];
      return (
        <Sequence key={scene.id} name={scene.id} from={scene.from} durationInFrames={scene.duration}>
          <SceneProvider value={scene}>
            <Scene />
            {captions ? <Captions /> : null}
          </SceneProvider>
        </Sequence>
      );
    })}
  </>
);
