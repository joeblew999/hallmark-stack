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

| What             | Track                                                                                                                                              | Here                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Versions         | `apps/web/package.json`, `pnpm-workspace.yaml` catalog                                                                                             | `package.json`, the same versions                                                              |
| Worker entry     | `apps/web/src/server.ts`: own routes first, then TanStack Start's handler                                                                          | `src/server.ts`: `/api/auth/*` to Better Auth, then TanStack Start                             |
| Vite             | `@cloudflare/vite-plugin` (SSR environment), Tailwind, TanStack Start, React                                                                       | `vite.config.ts`, the same plugins                                                             |
| Auth             | Better Auth on D1 via Drizzle; built on first use (`getAuth`), config free of `cloudflare:workers` so the CLI can generate the schema              | `src/server/auth/`: Track's sign-in through ID, copied (see Gateweave ID, below); no passwords |
| D1               | Identity only, migrations from drizzle-kit                                                                                                         | `migrations/`, identity only                                                                   |
| Durable Objects  | One per workspace, SQLite storage, the authority for its data                                                                                      | `VenueDO` (`src/server/venue-do.ts`), the authority for bookings                               |
| Server functions | `createServerFn` with `.validator(zod)`, `getRequest()` for the session                                                                            | `src/lib/bookings.ts`                                                                          |
| UI               | Tailwind 4 with shadcn/ui (`components.json`, new-york, radix-ui, lucide)                                                                          | the same `components.json`; shadcn's variables mapped onto Hallmark's tokens                   |
| Tests            | Vitest in Node and in workerd (`@cloudflare/vitest-plugin`), the built app in workerd (`test/track-worker.ts`), Playwright on the production build | the same: `src/**/*.test.ts`, `test/` (workerd), `test/app/` (the built app), `e2e/`           |
| Lint and format  | Biome (tabs, width 100)                                                                                                                            | `biome.json`, the same settings                                                                |
| Not set up yet   | `.dev.vars` from a script with a random `BETTER_AUTH_SECRET`; a 503 without DB or secret                                                           | `scripts/dev-setup.mjs`; the same 503                                                          |

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
  in carry on; only new sign-ins wait. ID's access and refresh tokens are never kept; its ID token is, as the
  `id_token_hint` that signs someone out at ID without a page asking first.
- **Sign out, everywhere:** "Sign out" ends courts' session and goes on to ID's end-session, which ends ID's session,
  tells every app (courts too) through back-channel logout, and comes back to the home page (registered with ID by
  `app:register`).
- **Signing out at ID, or deleting the ID account,** ends courts' sessions through back-channel logout
  (`/api/auth/backchannel-logout/oidc`), each by the ID session it came from (`session.oidc_sid`).

**From Track, copied and owned** (Track's auth lives in its private app package, so there is nothing to depend on;
Gateweave copies these between its own products, "owned here now, the way shadcn/ui components are", ID's
`AGENTS.md`). Each file says at the top what it came from at `b8b5ba0`, and what changed:

| Here                                                                | From Track's `apps/web/`                                                              | What it does                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/server/auth/oidc-sign-in.ts`                                   | `src/server/auth/oidc-sign-in.ts`                                                     | Sign-in through ID; back-channel logout; which ID session each session came from                     |
| `src/server/auth/config.ts`, `index.ts`                             | `src/server/auth/config.ts`, `index.ts`                                               | The rate limit on, telemetry off, the client's address; a logout seen through after ID stops waiting |
| `src/server/auth/workers-address.ts`                                | `src/server/auth/workers-address.ts`                                                  | Counts a Worker by its zone: every Worker on Cloudflare arrives from one address, ID's logouts too   |
| `src/server/rate-limit/`                                            | `src/server/rate-limit/` (the sign-in part)                                           | Limits that hold across every isolate, in a Durable Object                                           |
| `src/components/site/live-button.tsx`, `src/lib/sign-in-refusal.ts` | `src/components/live-button.tsx`, `src/lib/sign-in-refusal.ts`                        | The button that waits for the script; refusals in words of ours                                      |
| `test/app/`                                                         | `test/track-worker.ts`, `oidc-provider.ts`, `oidc-sign-in.test.ts`, `global-setup.ts` | The built app in workerd against a stand-in ID: what the real ID can't be made to do on demand       |

**Not copied, because they exist for Track's own accounts or its other parts:** passwords, email verification and
password reset (ID's), account linking, leaving ID signed in at sign-out, GitHub, workspaces, agents and MCP, the demo,
deleting an account (ID's), sync sockets.

The real ID is tested end to end by `mise run all:e2e`.

ID is pinned at release `v0.10.4` (commit `bd1d4e6`, checked 2026-11-07) in `scripts/id-release.mjs`. Deploying it, and
registering this app with it, are mise tasks: see Deploying, below.

Both run on Custom Domains on `ubuntusoftware.net` (this app on https://courts.ubuntusoftware.net, `wrangler.jsonc`):
two Workers on `workers.dev` can't reach each other at all. Issues #2 and #3 have the plans and their decisions.

## Deploying

Where things are deployed (Workers Custom Domains on `ubuntusoftware.net`, Cloudflare account `gedw99@gmail.com`;
also at the top of `mise.toml`):

- **This app:** https://courts.ubuntusoftware.net (the route in `wrangler.jsonc`)
- **Gateweave ID:** https://id.ubuntusoftware.net (`ID_DOMAIN` in `scripts/id-release.mjs`)

Everything that goes onto Cloudflare, or comes off it, is a mise task (the root `mise.toml`, the control plane), named
noun first:

| Task                         | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run cloudflare:login`  | Wrangler's device-code login: one click on the link it prints. Already logged in, it says as whom.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `mise run cloudflare:logout` | Ends it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `mise run id:deploy`         | Gateweave ID onto Cloudflare at https://id.ubuntusoftware.net (`scripts/id-deploy.mjs`): its pinned release fetched into the git-ignored `vendor/gateweave-id/` and installed with aube, deployed by ID's own deploy script, as the "Deploy to Cloudflare" button would. Set up for the internet (ID's `docs/self-hosting.md`): email from its own name, `id.ubuntusoftware.net` (Cloudflare Email Sending), so `ubuntusoftware.net`'s own mail records are never touched, for sign-up codes and password resets; ID's Turnstile, with a widget `gateweave-id`; the breached-password check. Then `id:claim`, then sign-up opened, so anyone can make an account. |
| `mise run id:claim`          | Who owns ID. A new ID server's first account owns it. On a new server this prints https://id.ubuntusoftware.net and waits for you to use Create account there in the browser, as `cloudflare:login` does: your password manager makes and keeps the password, and ID emails you a code to type in. The owner must be your Cloudflare login's email, or it stops.                                                                                                                                                                                                                                                                                                  |
| `mise run app:deploy`        | This app onto Cloudflare at https://courts.ubuntusoftware.net (`scripts/app-deploy.mjs`): build, then D1 migrations before the new code (after it on the first deploy, which creates the D1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `mise run app:register`      | This app registers itself with ID (`scripts/app-register.mjs`), after `id:deploy` and `app:deploy` (its `depends` in `mise.toml`, so the order is mise's, whichever task is run). Registered means ID has its client and the app has the settings; either missing, as after ID is rebuilt on its own, it registers again.                                                                                                                                                                                                                                                                                                                                         |
| `mise run all:deploy`        | All three: it is `app:register`, with its `depends`; then `all:e2e`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `mise run all:e2e`           | The live courts site through the live ID, in Chrome, no human (`scripts/all-e2e.mjs`): two throwaway people invited into ID (an invitation row, accepted with a password that exists only in that run) sign in, a double booking is refused, a cancel frees it, and signing out ends both courts and ID; then they are deleted from both.                                                                                                                                                                                                                                                                                                                         |
| `mise run app:undeploy`      | This app off Cloudflare, every piece (`scripts/app-undeploy.mjs`): its registration with ID, its Worker (domain, Durable Object, secrets, cron) and its D1. Its accounts and bookings are gone for good.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `mise run id:undeploy`       | Gateweave ID off Cloudflare, every piece (`scripts/id-undeploy.mjs`): its Worker (domain, secrets, `OIDC_PAIRWISE_SECRET` included), its D1, its logouts queue, its Turnstile widget and Email Sending for `id.ubuntusoftware.net`. Every account is gone, and every app that signs in through it gets new ids for everyone when ID is deployed again.                                                                                                                                                                                                                                                                                                            |
| `mise run all:undeploy`      | Both, the app first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Each one logs in first if it needs to, and each deploy ends by asking its real address until it answers right
(`waitUntilUp` in `scripts/cloudflare.mjs`): ID's discovery document with its own issuer, this site's home page, and
sign-in reaching ID's login page for this app's client. Undeploying and deploying again from nothing is how to know the deploy really
works; each undeploy step that finds its piece already gone says so and carries on.

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
- **Someone who deletes their Gateweave ID account** is signed out here and can't sign in again, but courts keeps
  its copy of their name and email (bookings go after a month). ID tells apps nothing about deleted accounts, only
  logouts; Track's `delete-account.ts` is there if courts needs its own.
- **The two photographs** are stand-ins from Hallmark's library, credited in the footer. Replace
  `public/images/clay-court.jpg` and `public/images/goal.jpg` with your own.

## Provenance and pins

- **Versions** are Track's at `b8b5ba0`, checked 2026-11-07. node `24.22.2` (Track pins 24) and aube `2.9.0` are the
  newest on that date.
- **`puppeteer-core` is held at 25.12.0.** Hallmark's lint drives Chrome through it. Every later release depends on
  `chromium-bidi` 157 or newer, which Google has published since October 2026 without npm provenance, and aube's
  trust policy refuses that. 25.12.0 is the last release built on `chromium-bidi` 17.0.2, which has it. Checked
  2026-11-07 against the npm registry.
- **`miniflare` is held at `5.20261023.3-beta`,** the one Wrangler 4.156.0 brings, for `test/app/`. Track's tests pin
  `5.20261023.0-beta`; one copy, the same as the deploys run, is the choice here.
- **Biome** has two CSS rules turned off for `src/styles/` (`biome.json`). `!important` is how Hallmark's
  reduced-motion and slot rules must win. The specificity-order warnings there are between selectors that never
  match the same element.

## Updating Hallmark

The pinned copy is upstream's `skills/hallmark/` folder. To move to a newer version, copy that folder from a newer
`Nutlope/hallmark` commit over `.claude/skills/hallmark/`, update the commit above, and run `aube run hallmark`.
