# hallmark-stack

**The problem.** A design skill like [Hallmark](https://github.com/Nutlope/hallmark) makes pages that look designed,
but left to itself it writes standalone HTML and CSS: nothing that signs people in, stores anything or deploys as an
app. And an app stack left to itself gets generic, generated-looking pages. Getting both, a real app whose every page
passes Hallmark's design gates, means locking Hallmark onto the stack so every later run builds inside it.

**What hallmark-stack does.** It is one working app, a court booking site (sample brand: Eastfield Courts), built on
the stack of [Gateweave's repositories](https://github.com/orgs/gateweavehq/repositories), taken from
[gateweavehq/track](https://github.com/gateweavehq/track), and designed with Hallmark, with Hallmark
locked to that stack: its tokens in Tailwind, its locked-system file (`DESIGN.md`) saying pages are TanStack routes,
its skill pinned in the repo, and its lint run on the rendered build in CI. Tools are pinned with mise; packages are
installed with aube.

## Tech stack

The stack is [Gateweave](https://gateweave.com)'s: every Gateweave product
([all their repositories](https://github.com/orgs/gateweavehq/repositories)) is built on it, Track and
[ID](https://github.com/gateweavehq/id) among them. Check there when the stack moves.

TanStack Start · React 19 · Tailwind CSS 4 · shadcn/ui · Better Auth · Drizzle ORM · Cloudflare Workers, Durable
Objects and D1 · Vite 8 · TypeScript 7 · Vitest · Playwright · Biome · zod. Tooling: mise (node, aube), aube, Hallmark.

## Track: the stack this is built on

[gateweavehq/track](https://github.com/gateweavehq/track) is an open-source issue tracker that runs entirely on
Cloudflare. Its `apps/web` is the technology basis here: the same libraries, at the same pinned versions, wired the
same way, in one package instead of Track's four.

Taken from Track at commit `b8b5ba0` (2026-11-06), checked 2026-11-07:

| What             | Track                                                                                                                                 | Here                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Versions         | `apps/web/package.json`, `pnpm-workspace.yaml` catalog                                                                                | `package.json`, the same versions                                            |
| Worker entry     | `apps/web/src/server.ts`: own routes first, then TanStack Start's handler                                                             | `src/server.ts`: `/api/auth/*` to Better Auth, then TanStack Start           |
| Vite             | `@cloudflare/vite-plugin` (SSR environment), Tailwind, TanStack Start, React                                                          | `vite.config.ts`, the same plugins                                           |
| Auth             | Better Auth on D1 via Drizzle; built on first use (`getAuth`), config free of `cloudflare:workers` so the CLI can generate the schema | `src/server/auth/`, the same pattern; email and password only                |
| D1               | Identity only, migrations from drizzle-kit                                                                                            | `migrations/`, identity only                                                 |
| Durable Objects  | One per workspace, SQLite storage, the authority for its data                                                                         | `VenueDO` (`src/server/venue-do.ts`), the authority for bookings             |
| Server functions | `createServerFn` with `.validator(zod)`, `getRequest()` for the session                                                               | `src/lib/bookings.ts`                                                        |
| UI               | Tailwind 4 with shadcn/ui (`components.json`, new-york, radix-ui, lucide)                                                             | the same `components.json`; shadcn's variables mapped onto Hallmark's tokens |
| Tests            | Vitest in Node and in workerd (`@cloudflare/vitest-plugin`), Playwright on the production build                                       | the same: `src/**/*.test.ts`, `test/` (workerd), `e2e/`                      |
| Lint and format  | Biome (tabs, width 100)                                                                                                               | `biome.json`, the same settings                                              |
| Not set up yet   | `.dev.vars` from a script with a random `BETTER_AUTH_SECRET`; a 503 without DB or secret                                              | `scripts/dev-setup.mjs`; the same 503                                        |

Left out on purpose, because a booking site doesn't need them: Track's protocol, sync-server and sync-client packages
(realtime sync, the IndexedDB replica, WebSockets, the service worker), MCP, the GitHub app, intake email,
organizations, R2 attachments and email sending.

Different on purpose: aube installs the packages, not pnpm, and mise pins node and aube (`mise.toml`); one package at
the root, not a workspace; one `aube run ci` that GitHub runs exactly, instead of Track's several jobs.

## Hallmark, locked to this stack

Hallmark's pre-flight reads a project before it designs. Four things here make every later Hallmark run build in
this stack, on this design, instead of writing standalone HTML:

1. **`DESIGN.md`**: Hallmark's locked-system file. With it present, Hallmark skips its theme deal and works inside
   the system: the Grid theme, its tokens, its controls, and the rule that a page is a route in `src/routes/` and a
   part is a component in `src/components/`.
2. **`src/styles/tokens.css`**: Hallmark's tokens in Tailwind 4's `@theme static` (as Hallmark's
   `references/export-formats.md` says), so they are utilities and variables; `src/styles.css` maps shadcn/ui's
   variables onto them and carries Hallmark's stamp in its first lines.
3. **`package.json`, `components.json`, `.hallmark/preflight.json`**: what the pre-flight reads to know the framework.
4. **`.claude/skills/hallmark/`**: Hallmark v2.0.0, pinned at upstream commit `407fa68` (MIT). Claude Code loads it
   as a project skill when the repo is opened: no plugin, nothing global. `.claude/settings.json` runs its edit-time
   lint on every CSS change, and `aube run hallmark` runs its full lint on the rendered production build, in CI too.

## Gateweave ID: the sign-in

[gateweavehq/id](https://github.com/gateweavehq/id) is Gateweave's OpenID Connect provider: one account for all our
apps, on its own Worker, on the same stack. It runs on Cloudflare only. This app signs in through it as Track does,
with a "Continue with Gateweave ID" button beside the password (`src/server/auth/oidc.ts`, Better Auth's
generic-oauth plugin), and ends someone's sessions here when they sign out there (back-channel logout). The button
appears only when `OIDC_ISSUER`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` are set.

ID is pinned at release `v0.10.4` (commit `bd1d4e6`, checked 2026-11-07) in `scripts/id-release.mjs`. Deploying it, and
registering this app with it, are mise tasks: see Deploying, below.

Both run on Custom Domains on `ubuntusoftware.net` (this app on https://courts.ubuntusoftware.net, `wrangler.jsonc`):
two Workers on `workers.dev` can't reach each other at all. Issue #2 has the plan and its decisions.

## Deploying

Where things are deployed (Workers Custom Domains on `ubuntusoftware.net`, Cloudflare account `gedw99@gmail.com`;
also at the top of `mise.toml`):

- **This app:** https://courts.ubuntusoftware.net (the route in `wrangler.jsonc`)
- **Gateweave ID:** https://id.ubuntusoftware.net (`ID_DOMAIN` in `scripts/id-release.mjs`)

Everything that goes onto Cloudflare, or comes off it, is a mise task (the root `mise.toml`, the control plane), named
noun first:

| Task                         | Does                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run cloudflare:login`  | Wrangler's device-code login: one click on the link it prints. Already logged in, it says as whom.                                                                                                                                                                                                                                 |
| `mise run cloudflare:logout` | Ends it.                                                                                                                                                                                                                                                                                                                           |
| `mise run id:deploy`         | Gateweave ID onto Cloudflare at https://id.ubuntusoftware.net (`scripts/id-deploy.mjs`): its pinned release fetched into the git-ignored `vendor/gateweave-id/` and installed with aube, deployed by ID's own deploy script, as the "Deploy to Cloudflare" button would. Sign up there straight away: the first account owns the server. |
| `mise run app:deploy`        | This app onto Cloudflare at https://courts.ubuntusoftware.net (`scripts/app-deploy.mjs`): build, then D1 migrations before the new code (after it on the first deploy, which creates the D1).                                                                                                                                            |
| `mise run app:register`      | This app registers itself with ID (`scripts/app-register.mjs`); already registered, it does nothing.                                                                                                                                                                                                                               |
| `mise run all:deploy`        | All three, in that order.                                                                                                                                                                                                                                                                                                          |
| `mise run app:undeploy`      | This app off Cloudflare, every piece (`scripts/app-undeploy.mjs`): its registration with ID, its Worker (domain, Durable Object, secrets, cron) and its D1. Its accounts and bookings are gone for good.                                                                                                                           |
| `mise run id:undeploy`       | Gateweave ID off Cloudflare, every piece (`scripts/id-undeploy.mjs`): its Worker (domain, secrets, `OIDC_PAIRWISE_SECRET` included), its D1 and its logouts queue. Every account is gone, and every app that signs in through it gets new ids for everyone when ID is deployed again.                                              |
| `mise run all:undeploy`      | Both, the app first.                                                                                                                                                                                                                                                                                                               |

Each one logs in first if it needs to. Undeploying and deploying again from nothing is how to know the deploy really
works; each undeploy step that finds its piece already gone says so and carries on.

## Secrets

- **Made by the tasks, kept by Cloudflare, never anywhere else.** Each secret is generated by the task that needs it and
  put straight into the Worker's secrets. It is never printed, never written to a file that stays, never in git, and no
  copy is kept anywhere: a Worker secret survives every deploy.
- **Set once, never reset.** A task that finds a secret already set leaves it as it is.
- **Which:** this app's `BETTER_AUTH_SECRET` (`app:deploy`, first deploy, passed in a file deleted straight after);
  ID's `BETTER_AUTH_SECRET` (ID's own deploy script, the same way); ID's `OIDC_PAIRWISE_SECRET` (`id:deploy`), which
  turns ID's sign-in provider on and gives each app its own id for each person, so it must never change; and the
  client id and secret ID issues this app (`app:register`, with `OIDC_ISSUER`).
- **Local development** uses `.dev.vars` (`aube run dev:setup` makes it), which is git-ignored and never leaves the
  machine.

## How it works

- **Accounts** are Better Auth's, in D1 (`src/server/auth/`, `migrations/`).
- **Bookings** belong to one `VenueDO` per venue (`src/server/venue-do.ts`). A unique index on court, date and hour
  makes a double booking impossible: the second one is refused and the page says someone took it.
- **The page** (`src/routes/index.tsx`, `src/components/site/`) loads the taken courts for four days with a server
  function, and books, lists and cancels with others (`src/lib/bookings.ts`).
- **Courts** have opaque UUIDs (`src/lib/courts.ts`), never names, so renaming one can't touch a booking.
- **A daily cron** deletes bookings older than a month.

## Getting started

[mise](https://mise.jdx.dev/getting-started.html) installed once per machine (`brew install mise`), and Google Chrome
for the end-to-end tests and Hallmark's lint. Then:

```sh
mise install            # node and aube, as pinned in mise.toml
aube install            # the packages, from aube-lock.yaml
aube run dev:setup      # .dev.vars with a random secret; the local D1 migrated
aube run dev            # http://localhost:4710
```

Every command is in [docs/commands.md](docs/commands.md), generated from `mise.toml` and `package.json`. `aube run ci` is everything
GitHub's CI runs, and the same here.

## Not real yet

- **Sample content:** the name Eastfield Courts, the courts and their layout, the sport details and the coaching
  timetable.
- **Opening hours and the address** are blank text slots (`data-fill` in `src/components/site/sections.tsx`).
- **The two photographs** are stand-ins from Hallmark's library, credited in the footer. Replace
  `public/images/clay-court.jpg` and `public/images/goal.jpg` with your own.

## Provenance and pins

- **Versions** are Track's at `b8b5ba0`, checked 2026-11-07. node `24.22.2` (Track pins 24) and aube `2.9.0` are the
  newest on that date.
- **`puppeteer-core` is held at 25.12.0.** Hallmark's lint drives Chrome through it. Every later release depends on
  `chromium-bidi` 157 or newer, which Google has published since October 2026 without npm provenance, and aube's
  trust policy refuses that. 25.12.0 is the last release built on `chromium-bidi` 17.0.2, which has it. Checked
  2026-11-07 against the npm registry.
- **Biome** has two CSS rules turned off for `src/styles/` (`biome.json`). `!important` is how Hallmark's
  reduced-motion and slot rules must win. The specificity-order warnings there are between selectors that never
  match the same element.

## Updating Hallmark

The pinned copy is upstream's `skills/hallmark/` folder. To move to a newer version, copy that folder from a newer
`Nutlope/hallmark` commit over `.claude/skills/hallmark/`, update the commit above, and run `aube run hallmark`.
