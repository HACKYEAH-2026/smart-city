import { SlideInLeft, SlideInRight } from "react-native-reanimated";

/** Where a section changing inside a screen (the code / link tabs) comes in from. */
export type SectionSide = "fromRight" | "fromLeft";

/** Entry of a section that changes inside a screen; it works on every platform. */
export function sectionEntering(side: SectionSide) {
  return side === "fromLeft" ? SlideInLeft : SlideInRight;
}
