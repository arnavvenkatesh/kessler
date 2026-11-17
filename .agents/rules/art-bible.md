# Art Bible Rules

1. **Strict Palette Only**: Use only these exact tokens (CSS variables and TS constants):
   - `--void`: `#0B0F1C` (Page and space background)
   - `--hull`: `#141B2F` (Panels and board plate)
   - `--grid`: `#26304D` (Grid lines, dividers)
   - `--chalk`: `#EDE6D1` (Primary text, outlines)
   - `--dust`: `#8C93A8` (Secondary text, disabled)
   - `--ember`: `#FF5A2B` (Ignition, rays, primary button)
   - `--solar`: `#FFC53D` (Beacons, score, highlights)
   - `--coolant`: `#3FD0C0` (Previews, safe or info states)
   - `--rust`: `#A8452D` (Spent, cracked, damaged)
   *Never use any other colors, gradients, glow, or blur.*

2. **Banned Aesthetic Tropes**:
   - No gradients, blur, glow, soft shadows, glassmorphism.
   - No purple or neon-cyan sci-fi styling.
   - No rounded-pill buttons or generic UI kit aesthetics.
   - No emoji as icons; no icon libraries or stock illustrations.
   - No centered hero-card layouts.

3. **Allowed Textures & Details**:
   - Hard 2px offset shadows (misregistration print effect, zero blur).
   - 4x4 Bayer ordered dither for starfield and shading.
   - 2px chalk outlines.
   - 45-degree chamfered panel corners (no rounded corners).

4. **Shapes**:
   - Hand-authored integer vertex arrays on a 24x24 grid in `src/app/render/shapes.ts`.
   - Polygons only; rocks are irregular polygons (never circles), with 3 variants per rock type.

5. **Typography**:
   - Big Shoulders Display (headings, condensed industrial) and IBM Plex Mono (UI and numbers).
   - Self-hosted `.woff2` files only.

6. **Motion & Audio**:
   - Stepped animation without easing curves. Ray drawing in 3 steps, 40ms hitstop per tick.
   - Pure WebAudio synthesis with A-minor pentatonic scale mapping (zero audio asset files).
