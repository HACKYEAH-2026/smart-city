import { getStaticFiles, staticFile } from "remotion";

/**
 * The ad's generated media, kept in public/ad and made by scripts/media.ts with the Gemini API: stills with the
 * Gemini image model, clips with Veo. The prompts live here, so each file can be made again and the README can
 * disclose how. While a file is missing, its scene shows a stand-in.
 */
type Still = { kind: "image"; file: string; prompt: string; edit?: string };
type Clip = { kind: "video"; file: string; prompt: string };

const LOOK = "Cinematic, realistic, natural light, 16:9, no people's faces in focus, no text, no captions, no logos.";

export const MEDIA = {
  "latarnia-on": {
    kind: "image",
    file: "ad/images/latarnia-on.jpg",
    prompt: `A quiet residential street in a Polish city at night after rain. In the foreground a single tall street lamp next to a bus stop shines a warm cone of light onto the wet pavement. Blocks of flats with a few lit windows in the background, deep blue night. ${LOOK}`,
  },
  latarnia: {
    kind: "image",
    file: "ad/images/latarnia.jpg",
    edit: "latarnia-on",
    prompt:
      "Edit this photo: the street lamp in the foreground is broken and switched off. Its lamp head is dark and no light falls on the pavement under it, so the bus stop is in darkness. Keep everything else in the picture exactly the same.",
  },
  chodnik: {
    kind: "image",
    file: "ad/images/chodnik.jpg",
    prompt: `A deep pothole and cracked concrete slabs in a city pavement in Poland, a puddle in the hole reflecting a street light, dusk, seen from a low angle, shallow depth of field. ${LOOK}`,
  },
  ogloszenie: {
    kind: "image",
    file: "ad/images/ogloszenie.jpg",
    prompt: `A cluttered notice board in the stairwell of a Polish block of flats: one official paper notice half covered by flyers, torn ads and old papers pinned over it, dim fluorescent light. The writing on all papers is blurred and unreadable. ${LOOK}`,
  },
  dom: {
    kind: "video",
    file: "ad/clips/dom.mp4",
    prompt:
      "Cinematic 16:9 shot, evening in a cozy Polish apartment, warm lamp light. A woman in her 30s sits on a sofa looking at her smartphone with a slight smile. Slow push-in from over her shoulder; the phone screen is out of focus, only its soft glow is visible. Shallow depth of field, realistic, natural warm colors, no text, no logos.",
  },
  osiedle: {
    kind: "video",
    file: "ad/clips/osiedle.mp4",
    prompt:
      "Cinematic 16:9 shot, golden hour on a green Polish housing estate: modern blocks of flats, trees, a playground. A young man walks along a path, stops and checks his smartphone. Side tracking shot, phone screen not visible. Realistic, warm light, no text, no logos.",
  },
  miasto: {
    kind: "video",
    file: "ad/clips/miasto.mp4",
    prompt:
      "Cinematic aerial drone shot at dusk, slowly flying over a European city with an old town, red roofs, a river and bridges, city lights turning on. Smooth forward motion, realistic, warm light, no text, no logos.",
  },
} as const satisfies Record<string, Still | Clip>;

export type MediaId = keyof typeof MEDIA;

/** The URL of a generated file to show, or null while it has not been made (then the scene shows a stand-in). */
export const mediaUrl = (id: MediaId) => {
  const file = MEDIA[id].file;
  return getStaticFiles().some((f) => f.name === file) ? staticFile(file) : null;
};
