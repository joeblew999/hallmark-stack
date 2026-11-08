# hallmark-stack

**The problem.** A design skill like [Hallmark](https://github.com/Nutlope/hallmark) makes pages that look designed,
but left to itself it writes standalone HTML and CSS: nothing that signs people in, stores anything or deploys as an
app. And an app stack left to itself gets generic, generated-looking pages. Getting both, a real app whose every page
passes Hallmark's design gates, means locking Hallmark onto the stack so every later run builds inside it.

**What hallmark-stack does.** It is one working app, a court booking site (sample brand: Eastfield Courts), built on
the stack of [Gateweave's repositories](https://github.com/orgs/gateweavehq/repositories), taken from
[gateweavehq/track](https://github.com/gateweavehq/track), and designed with Hallmark, with Hallmark
locked to that stack: its tokens in Tailwind, its locked-system file (`DESIGN.md`) saying pages are TanStack routes,
its skill pinned in the repo, and its lint run on every page: signed out on the rendered build in CI, signed in on the live staging site in `mise run all:e2e staging`. Tools are pinned with mise; packages are
installed with aube.

## Tech stack

The stack is [Gateweave](https://gateweave.com)'s: every Gateweave product
([all their repositories](https://github.com/orgs/gateweavehq/repositories)) is built on it, Track and
[ID](https://github.com/gateweavehq/id) among them. Check there when the stack moves.

TanStack Start · React 19 · Tailwind CSS 4 · shadcn/ui · Better Auth · Drizzle ORM · Cloudflare Workers, Durable
Objects and D1 · Vite 8 · TypeScript 7 · Vitest · Playwright · Biome · zod. Tooling: mise (aube), aube, Hallmark.

## Track: the stack this is built on

[gateweavehq/track](https://github.com/gateweavehq/track) is an open-source issue tracker that runs entirely on
Cloudflare. Its `apps/web` is the technology basis here: the same libraries, at the same pinned versions, wired the
same way, in one package instead of Track's four.

Taken from Track at commit `b8b5ba0` (2026-11-06), checked 2026-11-07:

| What             | Track                                                                                                                                              | Here                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versions         | `apps/web/package.json`, `pnpm-workspace.yaml` catalog                                                                                             | `package.json`, the same versions                                                                                                                                                   |
| Worker entry     | `apps/web/src/server.ts`: own routes first, then TanStack Start's handler                                                                          | `src/server.ts`: `/api/auth/*` to Better Auth, then TanStack Start                                                                                                                  |
| Vite             | `@cloudflare/vite-plugin` (SSR environment), Tailwind, TanStack Start, React                                                                       | `vite.config.ts`, the same plugins                                                                                                                                                  |
| Auth             | Better Auth on D1 via Drizzle; built on first use (`getAuth`), config free of `cloudflare:workers` so the CLI can generate the schema              | `src/server/auth/`: Track's sign-in through ID, copied (see Gateweave ID, below); no passwords                                                                                      |
| D1               | Identity only, migrations from drizzle-kit                                                                                                         | `migrations/`, identity only                                                                                                                                                        |
| Durable Objects  | One per workspace, SQLite storage, the authority for its data                                                                                      | `VenueDO` (`src/server/venue-do.ts`), the authority for bookings                                                                                                                    |
| Server functions | `createServerFn` with `.validator(zod)`, `getRequest()` for the session                                                                            | `src/lib/bookings.ts`                                                                                                                                                               |
| UI               | Tailwind 4 with shadcn/ui (`components.json`, new-york, radix-ui, lucide)                                                                          | the same `components.json`; shadcn's variables mapped onto Hallmark's tokens                                                                                                        |
| Tests            | Vitest in Node and in workerd (`@cloudflare/vitest-plugin`), the built app in workerd (`test/track-worker.ts`), Playwright on the production build | Vitest in Node and in workerd, Playwright on the production build; not Track's tests of its own code: `src/**/*.test.ts`, `test/` (workerd, with the real `wrangler.jsonc`), `e2e/` |
| Lint and format  | Biome (tabs, width 100)                                                                                                                            | `biome.json`, the same settings                                                                                                                                                     |
| Not set up yet   | `.dev.vars` from a script with a random `BETTER_AUTH_SECRET`; a 503 without DB or secret                                                           | `scripts/dev-setup.mjs`; the same 503                                                                                                                                               |

Left out on purpose, because a booking site doesn't need them: Track's protocol, sync-server and sync-client packages
(realtime sync, the IndexedDB replica, WebSockets, the service worker), MCP, the GitHub app, intake email,
organizations, R2 attachments and email sending.

Different on purpose: aube installs the packages, not pnpm, and mise installs node, pinned in `package.json` (`devEngines.runtime`), and aube, pinned in `mise.toml`; one package at
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
   lint on every CSS change, and `e2e/hallmark.spec.ts` runs its full lint on the rendered production build in every Playwright run, so in CI too (`aube run hallmark` runs just that spec).

## Gateweave ID: the only way in

[gateweavehq/id](https://github.com/gateweavehq/id) is Gateweave's OpenID Connect provider: one account for all our
apps, on its own Worker, on the same stack. It runs on Cloudflare only. **It is the only way into courts** (issue #3):
making an account, signing in and out, details, password, two-factor, passkeys and deleting the account are all ID's
own pages. Courts has no passwords, no sign-up and no login form.

- **Sign in:** "Sign in" (the header, or booking while signed out) goes to ID and comes back signed in. ID's own page
  offers making an account too, and comes back the same way. A refused sign-in comes back to `/login`, which says why
  in words of ours (`src/lib/sign-in-refusal.ts`). The button can't be pressed before the page's script has loaded
  (`src/components/site/live-button.tsx`): a press that early would do nothing.
- **What courts keeps:** who someone is, keyed by ID's id for them (`sub`), so bookings know whose they are, with
  their name and email taken from ID at every sign-in; and its own short session. If ID is down, people already signed
  in carry on; only new sign-ins wait. None of ID's tokens are kept.
- **Sign out:** courts' "Sign out" ends courts' own session, and leaves the person signed in at ID, as Track does:
  the next "Sign in" goes straight through.
- **Sign out everywhere: at ID.** Signing out on the Gateweave ID account page (linked from Your bookings), or
  deleting the ID account, ends courts' sessions through back-channel logout (`/api/auth/backchannel-logout/oidc`),
  each by the ID session it came from (`session.oidc_sid`).
- **Why not both in one go from courts:** ID's end-session would do it, and courts sent it correctly, but Gateweave
  ID asks "Confirm logout" even with a good `id_token_hint`, and then its own Content Security Policy
  (`form-action 'self'`) stops the browser coming back to courts: the person is signed out, but left on ID's page.
  Seen live on 2026-11-07 on v0.10.4; the same code is still in v0.11.4, checked 2026-11-07 (issue #7). When ID fixes that, courts can go
  back to it.

**From Track, copied and owned** (Track's auth lives in its private app package, so there is nothing to depend on;
Gateweave copies these between its own products, "owned here now, the way shadcn/ui components are", ID's
`AGENTS.md`). Each file says at the top what it came from at `b8b5ba0`, and what changed:

| Here                                                                | From Track's `apps/web/`                                       | What it does                                                                                           |
| ------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/server/auth/oidc-sign-in.ts`                                   | `src/server/auth/oidc-sign-in.ts`                              | Sign-in through ID; back-channel logout; which ID session each session came from                       |
| `src/server/auth/config.ts`, `index.ts`                             | `src/server/auth/config.ts`, `index.ts`                        | The rate limit on, telemetry off, the client's address; a logout seen through after ID stops waiting   |
| `src/server/auth/workers-address.ts`                                | `src/server/auth/workers-address.ts`                           | Counts a Worker by its zone: every Worker on Cloudflare arrives from one address, ID's logouts too     |
| `src/server/rate-limit/`                                            | `src/server/rate-limit/` (the sign-in part)                    | Limits that hold across every isolate, in one Durable Object for every client, not one per client (#5) |
| `src/components/site/live-button.tsx`, `src/lib/sign-in-refusal.ts` | `src/components/live-button.tsx`, `src/lib/sign-in-refusal.ts` | The button that waits for the script; refusals in words of ours                                        |

**Not copied, because they exist for Track's own accounts or its other parts:** passwords, email verification and
password reset (ID's), account linking, GitHub, workspaces, agents and MCP, the demo,
deleting an account (ID's), sync sockets.

The real ID is tested end to end by `mise run all:e2e staging`.

ID is pinned at release `v0.11.4`, commit `fd09b4b`, checked 2026-11-07 (v0.11.x: a session and its person read in one query, password tries held per person, and "sign out everywhere" on the account page; no database migrations since v0.10.6), in `scripts/id-release.mjs`: `ID_RELEASE` is the tag and `ID_COMMIT` the commit it named, which every ID task checks (`fetchId`), and ID's packages come from ID's own lockfile. Deploying it, and
registering this app with it, are mise tasks: see Deploying, below.

Both run on Custom Domains on `ubuntusoftware.net`: two Workers on `workers.dev` can't reach each other at all. Issues
#2 and #3 have the plans and their decisions.

## Deploying

Two environments, Wrangler's way (issue #9): `staging` and `production`, each a block under `env` in `wrangler.jsonc`
(courts) and `id.jsonc` (Gateweave ID). The top level of each file is development, which is never deployed. Each
environment has its own Workers, D1s, queue, Turnstile widget, Email Sending name and secrets; nothing is shared, so
staging can be torn down and rebuilt without touching production. Cloudflare account `gedw99@gmail.com`:

| Environment | Courts                                    | Gateweave ID                          | Workers and D1s                      |
| ----------- | ----------------------------------------- | ------------------------------------- | ------------------------------------ |
| staging     | https://courts-staging.ubuntusoftware.net | https://id-staging.ubuntusoftware.net | `courts-staging`, `id-staging`       |
| production  | https://courts.ubuntusoftware.net         | https://id.ubuntusoftware.net         | `courts-production`, `id-production` |

Everything that goes onto Cloudflare, or comes off it, is a mise task in the root `mise.toml` (the control plane),
named noun first, and every one of them names its environment: `mise run all:deploy staging`. None has a default, so
production is only ever deployed by asking for it. Each task is in [docs/commands.md](docs/commands.md). The usual run:

```sh
mise run all:deploy staging     # ID, then courts, then courts registered with ID, then all:e2e staging
mise run all:deploy production  # the same; its all:e2e only reads
mise run all:undeploy staging   # courts, then ID, every piece; their accounts and bookings gone for good
```

`scripts/environments.mjs` holds the two names, and `scripts/app-config.mjs` and `scripts/id-release.mjs` read each
environment's names and address back from the config as Wrangler does, so nothing is written twice.
`aube run config:check` (in CI) fails if an environment is missing or incomplete.

- **Where the data lives (issue #5):** both D1s are made in Asia-Pacific (`--location apac`, `LOCATION` in
  `scripts/environments.mjs`) before their first deploy, and the bookings Durable Object is asked for with
  `locationHint` `apac` (`LOCATION` in the config's vars, `src/server/venue.ts`). Both only count when the thing is first
  made: moving one means making it again. Both Workers run next to their D1s whoever calls them (`placement.region`, `PLACEMENT`
  in `scripts/environments.mjs`: Tokyo, measured nearest APAC D1); left to run next to the caller, a sign-in from the US
  paid 210 ms for each of its D1 queries. Tracing is on (`observability.traces`), so each D1 and binding call is timed.
- **ID** is its pinned release, fetched into the git-ignored `vendor/gateweave-id/`, with our two environments written
  into its `wrangler.jsonc` from `id.jsonc`, and deployed by ID's own deploy script, as Gateweave deploy theirs. It is
  set up for the internet (ID's `docs/self-hosting.md`): email from its own name (Cloudflare Email Sending), so
  `ubuntusoftware.net`'s own mail records are never touched; its own Turnstile widget, named after its Worker; the
  breached-password check.
- **Claiming ID:** a new ID server's first account owns it. On a new server `id:claim` prints its address and waits for
  you to use Create account there; ID emails you a code. The owner must be your Cloudflare login's email, or it stops.
  Each environment's ID is claimed once.
- **The live suite** (`all:e2e`, `playwright.live.config.ts`, `e2e/live/`) has one Playwright project per environment.
  Staging runs everything: two throwaway people invited into ID (an invitation row, accepted with a password that
  exists only in that run) sign in, book and sign out, and are deleted afterwards, with anything a killed run left.
  Production runs only the read-only checks that both answer and are paired: nobody is made and nothing is booked on
  the site real people use.
- **Undeploying ID** takes five of Email Sending's six DNS records with it; the sixth,
  `TXT _dmarc.id[-staging].ubuntusoftware.net`, Cloudflare leaves, and Wrangler can't edit DNS, so the task says to
  delete it. Every app that signs in through that ID gets new ids for everyone when it is deployed again.

Each task logs in first if it needs to, and each deploy ends by asking its real address until it answers right
(`waitUntilUp` in `scripts/cloudflare.mjs`): ID's discovery document with its own issuer, courts' `/api/auth/ok`, and
sign-in reaching ID's login page for courts' client. Each undeploy step that finds its piece already gone says so and
carries on.

## Secrets

- **Made by the tasks, kept by Cloudflare, never anywhere else.** Each secret is generated by the task that needs it and
  put straight into the Worker's secrets. It is never printed, never written to a file that stays, never in git, and no
  copy is kept anywhere: a Worker secret survives every deploy.
- **Set once, never reset.** A task that finds a secret already set leaves it as it is.
- **Which:** this app's `BETTER_AUTH_SECRET` (`app:deploy`, first deploy, passed in a file deleted straight after);
  ID's `BETTER_AUTH_SECRET` (ID's own deploy script, the same way); ID's `OIDC_PAIRWISE_SECRET` (`id:deploy`), which
  turns ID's sign-in provider on and gives each app its own id for each person, so it must never change; ID's `TURNSTILE_SECRET_KEY`
  (`id:deploy`), which Cloudflare makes with ID's Turnstile widget; and the client id and secret ID issues this app (`app:register`, with `OIDC_ISSUER`).
- **Local development** uses `.dev.vars` (`aube run dev:setup` makes it), which is git-ignored and never leaves the
  machine.

## How it works

- **Accounts** are Gateweave ID's. Courts keeps who signed in through it, and their sessions, in D1 with Better Auth
  (`src/server/auth/`, `migrations/`); see Gateweave ID, above.
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
mise install            # node (package.json devEngines.runtime) and aube (mise.toml)
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
- **Someone who deletes their Gateweave ID account** is signed out here and can't sign in again, but courts keeps
  its copy of their name and email (bookings go after a month). ID tells apps nothing about deleted accounts, only
  logouts; Track's `delete-account.ts` is there if courts needs its own.
- **The two photographs** are stand-ins from Hallmark's library, credited in the footer. Replace
  `public/images/clay-court.jpg` and `public/images/goal.jpg` with your own.

## Keeping versions current

Two sides, each with its own check and its own update, and neither update touches the other's files:

| Side          | Its files                        | What's on it                                                                                                                                                                                                | Check                  | Update                  |
| ------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------- |
| The app       | `package.json`, `aube-lock.yaml` | Everything the app needs to build, test and run: its packages, node (`devEngines.runtime`, which aube locks with checksums and mise installs) and Better Auth's CLI (it must match the app's `better-auth`) | `mise run deps:check`  | `mise run deps:update`  |
| Control plane | `mise.toml`                      | The tools that run the repo: aube                                                                                                                                                                           | `mise run tools:check` | `mise run tools:update` |

- **Checks** read only. `deps:check` fails only on what's new: packages held on purpose (`updateConfig`) and advisories known and
  accepted (`auditConfig`, each with its reason) are listed in `aube-workspace.yaml`.
- **Updates** pin exact versions; run `aube run ci` after, then commit. Not in CI: their answers change whenever
  something is published.
- **The control plane deploys with the app's own wrangler** (`cloudflare:`, `id:` and `app:` tasks), the one the app
  was built and tested with.

## Provenance and pins

- **Versions** are Track's at `b8b5ba0`, checked 2026-11-07. node `24.22.2` (Track pins 24; in package.json's `devEngines.runtime`) and aube `2.9.0` (mise.toml) are the
  newest on that date.
- **`puppeteer-core` is held at 25.12.0.** Hallmark's lint drives Chrome through it. Every later release depends on
  `chromium-bidi` 157 or newer, which Google has published since October 2026 without npm provenance, and aube's
  trust policy refuses that. 25.12.0 is the last release built on `chromium-bidi` 17.0.2, which has it. `aube-workspace.yaml` keeps it out of `mise run deps:update` (`updateConfig.ignoreDependencies`), so it stays put while everything else moves. Checked
  2026-11-07 against the npm registry.
- **Biome** has two CSS rules turned off for `src/styles/` (`biome.json`). `!important` is how Hallmark's
  reduced-motion and slot rules must win. The specificity-order warnings there are between selectors that never
  match the same element.

## Updating Hallmark

The pinned copy is upstream's `skills/hallmark/` folder. To move to a newer version, copy that folder from a newer
`Nutlope/hallmark` commit over `.claude/skills/hallmark/`, update the commit above, and run `aube run hallmark`.
