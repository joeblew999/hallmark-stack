# hallmark-stack

A sports booking site (sample brand: Eastfield Courts) built with [Hallmark](https://github.com/Nutlope/hallmark), the design skill for Claude Code. It's a static page: `index.html` plus three stylesheets, with no build step.

## What's here

| Path                                   | What it is                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                           | The page, plus the plain-JS behaviour: booker, site plan, sport switcher, sticky bar, `/` search                           |
| `page.css`                             | The page styles. Lines 1–7 are the Hallmark stamp: every design decision, the critique line and the answered finish checks |
| `tokens.css`, `base.css`               | Written by `theme.mjs scaffold grid`: the Grid theme's tokens and Hallmark's base rules                                    |
| `images/`                              | Two photographs from Hallmark's library (credited in the page footer)                                                      |
| `.hallmark/log.json`, `.hallmark/salt` | Hallmark's build log; the next build reads it so it doesn't repeat this one                                                |
| `.claude/skills/hallmark/`             | Hallmark v2.0.0, pinned at upstream commit `407fa68` (MIT), so the repo works without a global install                     |
| `.claude/settings.json`                | Hallmark's edit-time lint hook, pointed at the pinned copy via `$CLAUDE_PROJECT_DIR`                                       |

`.hallmark/shots/` (render screenshots) is git-ignored, as Hallmark ships it.

## The design, in one place

The decisions live in the stamp at the top of `page.css`:

- Shape: Map / Diagram
- Theme: Grid (Swiss poster: ultramarine field, one red mark, Radio Canada Big)
- Hero: Stage
- Nav: search-led bar
- Footer: colophon block
- Job: book a court
- Signature: the court booker, with the chosen hour at poster scale

## Running and checking it

Open `index.html` in a browser, or serve the folder with any static server.

The lint runs the same here as in a Claude cloud session. It needs Node 18+, Chrome for the render tier, and `puppeteer-core` on the Node path:

```
node .claude/skills/hallmark/scripts/sloplint.mjs index.html --render --genre editorial
```

Expected result: `0 FAIL, 0 REFLEX, 0 WARN`. Without puppeteer and Chrome, the static checks still run.

## Not real yet

- **Booking isn't connected.** The form has `data-endpoint=""`, and pressing Book says plainly that nothing was booked. Hallmark forbids a fake success state.
- **Availability is a fixed sample pattern** (`taken()` in `index.html`). Swap it for the real API.
- **Opening hours and the address are blank text slots** (`data-fill="hours"`, `data-fill="address"`).
- **The court layout, sport details, coaching timetable and the name "Eastfield Courts" are samples.**
- **Photo slots** `court-photo` and `pitch-photo` take your own pictures. Call `hallmarkSlots({ 'court-photo': 'yours.jpg' })` or replace the files.

## Updating Hallmark

The pinned copy is upstream's `skills/hallmark/` folder. To move to a newer version, re-copy that folder from a newer `Nutlope/hallmark` commit and update the commit hash above.
