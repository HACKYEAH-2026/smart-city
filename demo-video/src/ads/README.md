# Ads: variants side by side

Each folder is one ad, developed on its own and compared with the others before one is picked:

| Folder | Composition | Angle |
|---|---|---|
| `problems/` | `AdProblems` | opens on what goes wrong in a city today, then the app and the AI plugin builder (draft, captions) |
| `needs/` | `AdNeeds` | a city, a campus and a housing cooperative need different things; one app fits each (44 s, voiced) |
| `needs-2/` | `AdNeeds2` | second cut of `needs`: a fourth panel „i więcej”, the city's questions answered at once, the builder's publish reaching every member live (53 s, voiced) |

A variant has `script.ts` (the narration, one beat per scene), `timing.ts` (room around each beat), `scenes.tsx`
(one component per beat) and `Ad.tsx` (the composition, registered in `src/Root.tsx`). Everything a variant
shares lives in `shared/`: the phone and the app's screens (real components, plugin views drawn by the app's own
renderer), the stage pieces, the plugin builder pieces, the timing engine and the generated media.

- Preview: `bun run dev` (Remotion Studio), pick the composition.
- Render: `bun run render:problems`, `bun run render:needs`, `bun run render:needs-2` → `out/ad-<variant>.mp4`.
- Narration (paid, on purpose only): `bun run vo <variant>` records the script with ElevenLabs into
  `public/ad/voice/<variant>.mp3` and `<variant>/vo.json`. A variant whose `timing.ts` passes that take to
  `timeline()` is timed by its recorded words and plays each scene's slice of it (no captions). Until a variant is
  recorded, or after its script changed, the scenes are timed by an estimate of the read and the draft shows captions.
- Generated stills and clips (paid, on purpose only): add a prompt to `shared/media.ts`, then `bun run media`
  makes whatever is missing in `public/ad/`; a `frame` entry is a still taken from a generated clip (free). Scenes
  show a stand-in while a file is missing.
- The phone screens follow the app: `shared/screens.tsx` builds them from the app's components, its plugin renderer
  and header, in the layout of `apps/app/src/screens`. When the app's UI changes, update them there.

A new variant: copy a folder, give its `Ad` a new composition id in `src/Root.tsx`, add its name to `ADS` in
`scripts/voiceover.ts` and a `render:<variant>` script in `package.json`.
