import type { ComponentType } from "react";
import { Sequence } from "remotion";
import "../../app-ui";
import { Captions, SceneProvider } from "./kit";
import type { Scene } from "./timing";

export type AdProps = { captions: boolean };

/** An ad: its scenes in order, each timed by its narration beat; `captions` shows the narration as text. */
export const AdSequence = ({
  scenes,
  components,
  captions,
}: {
  scenes: Scene[];
  components: Record<string, ComponentType>;
  captions: boolean;
}) => (
  <>
    {scenes.map((scene) => {
      const Component = components[scene.id];
      if (!Component) throw new Error(`No scene component for beat "${scene.id}"`);
      return (
        <Sequence key={scene.id} name={scene.id} from={scene.from} durationInFrames={scene.duration}>
          <SceneProvider value={scene}>
            <Component />
            {captions ? <Captions /> : null}
          </SceneProvider>
        </Sequence>
      );
    })}
  </>
);
