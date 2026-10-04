import { getStaticFiles, staticFile } from "remotion";

/**
 * The ads' generated media (shared by every variant), kept in public/ad and made by scripts/media.ts with the Gemini API: stills with the
 * Gemini image model, clips with Veo. The prompts live here, so each file can be made again and the README can
 * disclose how. While a file is missing, its scene shows a stand-in.
 */
export type Still = { kind: "image"; file: string; prompt: string; edit?: string };
/**
 * `start`: the clip opens on this frame of another clip (Veo image-to-video), so one shot continues the other.
 * `first`: it opens on this still instead; `last`: it ends on this still (Veo first and last frame).
 */
export type Clip = {
  kind: "video";
  file: string;
  prompt: string;
  start?: { clip: string; second: number };
  first?: string;
  last?: string;
};

/** Every generated clip is this long (Veo); a shot longer than what is left of its clip slows the clip down. */
export const CLIP_SECONDS = 8;

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
  kampus: {
    kind: "video",
    file: "ad/clips/kampus.mp4",
    prompt:
      "Cinematic 16:9 shot, a modern Polish university campus on a sunny autumn morning: students with backpacks walk between faculty buildings, one student stops and checks her smartphone. Slow tracking shot, phone screen not visible. Realistic, warm light, no text, no logos.",
  },
  spoldzielnia: {
    kind: "video",
    file: "ad/clips/spoldzielnia.mp4",
    prompt:
      "Cinematic 16:9 shot, a renovated 1970s block of flats of a Polish housing cooperative with a colourful facade and a green courtyard with benches, late afternoon. An older man stands by the entrance and looks at his smartphone. Static camera with a slight push-in, phone screen not visible. Realistic, natural light, no text, no logos.",
  },
  "kampus-qr": {
    kind: "video",
    file: "ad/clips/kampus-qr.mp4",
    start: { clip: "kampus", second: 6.5 },
    prompt:
      "Continue this shot without a cut: the young woman in the beige coat with the green backpack lowers her phone, walks a few steps to the glass entrance of the faculty building where a printed poster with a large QR code hangs at eye level, raises her smartphone and scans the QR code. The camera follows her and ends in an over-the-shoulder close-up of her phone held up to the QR code on the poster, the phone screen not readable. Sunny autumn campus, realistic, natural light, no readable text, no logos.",
  },
  sala: {
    kind: "image",
    file: "ad/images/sala.jpg",
    prompt: `An empty modern seminar room at a Polish university: rows of desks, a whiteboard, a projector screen, large windows with daylight. ${LOOK}`,
  },
} as const satisfies Record<string, Still | Clip>;

export type MediaId = keyof typeof MEDIA;

/** The URL of a generated file to show, or null while it has not been made (then the scene shows a stand-in). */
export const mediaUrl = (id: MediaId) => {
  const file = MEDIA[id].file;
  return getStaticFiles().some((f) => f.name === file) ? staticFile(file) : null;
};
