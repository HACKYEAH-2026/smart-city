import type { ComponentType } from "react";
import { Audio, Sequence, staticFile } from "remotion";
import "../../app-ui";
import { Captions, SceneProvider } from "./kit";
import type { Scene } from "./timing";

export type AdProps = { captions: boolean };

/**
 * An ad: its scenes in order, each timed by its narration beat; `captions` shows the narration as text. With
 * `voice` (the take in public/), each recorded scene plays its slice of it.
 */
export const AdSequence = ({
  scenes,
  components,
  captions,
  voice,
}: {
  scenes: Scene[];
  components: Record<string, ComponentType>;
  captions: boolean;
  voice?: string;
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
            {voice && scene.voice ? (
              <Sequence name="voice" from={scene.voice.from} layout="none">
                <Audio
                  src={staticFile(voice)}
                  trimBefore={scene.voice.trimBefore}
                  durationInFrames={scene.voice.frames}
                />
              </Sequence>
            ) : null}
          </SceneProvider>
        </Sequence>
      );
    })}
  </>
);
