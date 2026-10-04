import { type AdProps, AdSequence } from "../shared/Ad";
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
import { SCENES } from "./timing";

/** The "problems" ad: it opens on what goes wrong in a city today, then shows the app and its plugin builder. */
export const AdProblems = ({ captions }: AdProps) => (
  <AdSequence
    scenes={SCENES}
    captions={captions}
    components={{
      open: OpenScene,
      problem: ProblemScene,
      reveal: RevealScene,
      join: JoinScene,
      report: ReportScene,
      city: CityScene,
      builder: BuilderScene,
      outro: OutroScene,
    }}
  />
);
