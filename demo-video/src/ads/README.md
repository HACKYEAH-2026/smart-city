# Ads: variants side by side

Each folder is one ad, developed on its own and compared with the others before one is picked:

| Folder | Composition | Angle |
|---|---|---|
| `problems/` | `AdProblems` | opens on what goes wrong in a city today, then the app and the AI plugin builder |
| `needs/` | `AdNeeds` | a city, a campus and a housing cooperative need different things; one app fits each |

A variant has `script.ts` (the narration, one beat per scene), `timing.ts` (room around each beat), `scenes.tsx`
(one component per beat) and `Ad.tsx` (the composition, registered in `src/Root.tsx`). Everything a variant
shares lives in `shared/`: the phone and the app's screens (real components, plugin views drawn by the app's own
renderer), the stage pieces, the plugin builder pieces, the timing engine and the generated media.

- Preview: `bun run dev` (Remotion Studio), pick the composition.
- Render: `bun run render:problems`, `bun run render:needs` → `out/ad-<variant>.mp4`.
- Narration (paid, on purpose only): `bun run vo <variant>` records the script with ElevenLabs; until then the
  scenes are timed by an estimate of the read and the draft shows captions.
- Generated stills and clips (paid, on purpose only): add a prompt to `shared/media.ts`, then `bun run media`
  makes whatever is missing in `public/ad/`. Scenes show a stand-in while a file is missing.

A new variant: copy a folder, give its `Ad` a new composition id in `src/Root.tsx`, add its name to `ADS` in
`scripts/voiceover.ts` and a `render:<variant>` script in `package.json`.
