# Design: Eastfield Courts

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: editorial
- Shape of the first page: Map / Diagram (draw e0e34c)
- Theme: Grid (dealt 2/3, seed sports-booking-book-courts-35ee·e59d428f·2026-11-07·r0)
- Axes: light/grotesk-sans/cool · posture: full-palette

## Stack
Pages are TanStack Start routes in `src/routes/` (React 19), styled with Tailwind 4 and hand-written CSS on these
tokens; shadcn/ui components (`components.json`) take the same tokens through the variables in `src/styles.css`.
Never a standalone `.html` page: a new page is a route, a new part is a component in `src/components/`.

## Tokens
`src/styles/tokens.css` is the source of truth, in Tailwind's `@theme static` (colours, faces, sizes, tracking, radii,
shadows, easings, so `bg-paper`, `text-ink`, `font-display` work) and `:root` (space, layout, motion, layers).
```css
:root {
  --color-paper: oklch(97.5% 0.005 90);  --color-paper-2: oklch(94.2% 0.006 90);  --color-paper-3: oklch(90.5% 0.008 90);
  --color-ink: oklch(19% 0.022 266);  --color-ink-2: oklch(31% 0.02 266);  --color-muted: oklch(47% 0.016 266);  --color-rule: oklch(87.5% 0.008 90);
  --color-accent: oklch(44% 0.2 266);  --color-accent-ink: oklch(97.5% 0.005 90);  --color-focus: oklch(46% 0.2 266);
  --color-field: oklch(44% 0.2 266);  --color-mark: oklch(57% 0.215 29);
  --font-display: "Radio Canada Big", ui-sans-serif, system-ui, sans-serif;  --font-body: "Radio Canada", ui-sans-serif, system-ui, sans-serif;
  --radius-card: 0;  --radius-pill: 0;  --rule-hair: 1px;  --shadow-card: none;
}
```
The spacing scale, the type scale, the easings and the durations are the scaffold's and live in `tokens.css`. Fonts
are self-hosted from `@fontsource/radio-canada-big` and `@fontsource/radio-canada` (imported in `src/styles.css`).

## Controls
- Primary: a square block of ink with paper text · radius 0 · 52px; on ink chrome it inverts to paper on ink
- Secondary: text with a 1px underline that turns mark red on hover · same height where it sits beside a button

## Motion
- Character: still. State only (a value swaps, a link turns red), `--dur-short` on `--ease-out`; no reveals; under
  reduced motion everything ends at once.

## Exports
`src/styles/tokens.css` (Tailwind v4 `@theme static` plus `:root`) and the shadcn/ui variable map in `src/styles.css`,
per Hallmark's `references/export-formats.md`.
