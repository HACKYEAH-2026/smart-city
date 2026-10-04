import { type AdProps, AdSequence } from "../shared/Ad";
import { BuilderScene, CampusScene, CityScene, CoopScene, IntroScene, OutroScene, PromiseScene } from "./scenes";
import { SCENES } from "./timing";

/**
 * The "needs" ad: a city, a campus and a housing cooperative need different things; one app fits each, and what
 * is missing the AI plugin builder adds.
 */
export const AdNeeds = ({ captions }: AdProps) => (
  <AdSequence
    scenes={SCENES}
    captions={captions}
    components={{
      intro: IntroScene,
      promise: PromiseScene,
      city: CityScene,
      campus: CampusScene,
      coop: CoopScene,
      builder: BuilderScene,
      outro: OutroScene,
    }}
  />
);
