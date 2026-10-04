import { timeline } from "../shared/timing";
import { BEATS } from "./script";

/** Frames of picture before the first word and after the last one, per scene. */
export const { scenes: SCENES, duration: DURATION } = timeline(BEATS, {
  open: { lead: 18, tail: 10 },
  problem: { lead: 6, tail: 16 },
  reveal: { lead: 14, tail: 14 },
  join: { lead: 10, tail: 12 },
  report: { lead: 10, tail: 18 },
  city: { lead: 8, tail: 22 },
  builder: { lead: 12, tail: 40 },
  outro: { lead: 8, tail: 90 },
});
