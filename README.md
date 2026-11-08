# hallmark-stack

A court booking website (sample brand: Eastfield Courts) built on Gateweave's app stack, with every page designed by
[Hallmark](https://github.com/Nutlope/hallmark). People sign in with [Gateweave ID](https://github.com/gateweavehq/id)
and book tennis courts. It runs on Cloudflare.

Why it exists: Hallmark on its own makes good-looking but static HTML pages. An app stack on its own makes working
but generic-looking pages. This repo ties the two together, so Hallmark builds real pages of a real app and every
page is checked against Hallmark's design rules.

Every command is listed in [docs/commands.md](docs/commands.md). That file is generated, so it is always right.

## Getting started

You need [mise](https://mise.jdx.dev/getting-started.html) (`brew install mise`). Then:

```sh
mise install          # the tools this repo pins (mise.toml, checked against mise.lock), mise-check among them
mise doctor project   # says if anything mise can't install is missing (Google Chrome, Claude Code)
mise run all:dev      # runs the site and Gateweave ID on this machine
```

mise installs the app's packages itself, before any task, whenever `package.json` or `aube-lock.yaml` changed
(`[deps.aube]` in `mise.toml`). Nobody runs `aube install`.

The same commands work on a Mac and in a Claude cloud session. A cloud session runs
`.claude/hooks/mise-check-session-start.sh` when it starts, which installs mise and the tools, so it begins where a
developer's machine is after `mise install`.

## Running it locally

`mise run all:dev` runs the same two parts as staging and production, on your machine: Gateweave ID and the site.
Nothing goes to Cloudflare. Each has its own local database.

The two dev servers run in the background as mise daemons (`[daemons]` in `mise.toml`, run by Pitchfork). `all:dev`
starts them, waits until both answer, and then ends. They keep running:

```sh
mise daemons status        # are they running
mise daemons logs courts   # what the site's server printed (or: logs id)
mise daemons stop          # stop both
```

Running `mise run all:dev` again restarts them with the current settings.

Both are put on public https addresses through Tailscale Funnel, so you can open them in any browser, including your
phone, and sign-in works:

- the site: `https://hallmark-stack-<machine>.<tailnet>.ts.net`
- Gateweave ID: `https://hallmark-stack-id-<machine>.<tailnet>.ts.net`

The first time on a machine:

1. Tailscale prints a sign-in link for each of the two. Open it and sign in. Funnel may print an approval link too.
2. The new local Gateweave ID has no owner. The command prints its address. Use Create account there. The local ID
   sends no real email, so the code it would email is printed in the terminal instead.

Things worth knowing:

- Tailscale is used because a Claude cloud session can only reach the internet on port 443. Cloudflare's tunnel
  needs port 7844, and free ngrok can't go through the session's proxy.
- `mise run tailscale:logout` signs out, but the two machines stay in
  [your Tailscale machine list](https://login.tailscale.com/admin/machines) until you remove them there. If you sign in
  again first, Tailscale gives them new names ending in `-1`. `tailscale:login` says when that happens, and stops if an
  address changed, because a passkey only works on the address it was made on.
- The local ID's accounts and emails are kept in `vendor/gateweave-id/apps/web/.wrangler/`. Updating ID keeps them.
- The first page load is slow (a few seconds), because the dev server sends hundreds of small files through the
  tunnel. Staging and production are fast.
- `aube run dev` runs the site alone, signed out.

## How everyone works

Developers, GitHub's CI and Claude all do the same things, with the same commands:

- **Everything is a mise task:** `mise run <task>`. The list is [docs/commands.md](docs/commands.md).
- **Checks and tests:** `mise run test`. GitHub runs `mise run mise-check:verify`, which checks the lockfiles, runs
  `mise run setup` and `mise run test`, then mise-check's own rules. Run it yourself to see exactly what CI sees.
- **Seeing what ran:**

  ```sh
  mise tasks history              # every run: when, how long, which environment, passed or failed
  mise tasks log all:e2e          # everything the last run of a task printed
  mise daemons logs courts        # what a dev server printed (or: logs id)
  ```

- **No private ways in.** Claude runs no wrappers, log files or scripts of its own. If something is awkward to run or
  read, it is fixed in the repo, for everyone.

## Deploying

There are two environments, staging and production. Each has its own Workers, databases and secrets, so staging can be
removed and rebuilt without touching production. They are set up the way Wrangler does it: `env.staging` and
`env.production` in `wrangler.jsonc` (the site) and `id.jsonc` (Gateweave ID). The top level of each file is
development, which is never deployed.

| Environment | The site                                  | Gateweave ID                          |
| ----------- | ----------------------------------------- | ------------------------------------- |
| staging     | https://courts-staging.ubuntusoftware.net | https://id-staging.ubuntusoftware.net |
| production  | https://courts.ubuntusoftware.net         | https://id.ubuntusoftware.net         |

Cloudflare account: `gedw99@gmail.com`.

```sh
mise run all:deploy staging     # deploys ID, then the site, connects them, then tests them
mise run all:deploy production  # the same; its tests only read, they book nothing
mise run all:undeploy staging   # removes everything; asks first, as its accounts and bookings are lost
```

Every deploy task needs the environment named. There is no default, so production is only deployed when you ask for it.
Each task logs in to Cloudflare first if needed, and waits at the end until the deployed site answers.

- **A new Gateweave ID has no owner.** The first account made on it owns it. `id:deploy` prints its address and waits
  for you to create that account; ID emails you a code. The owner must be the email you log in to Cloudflare with.
- **Data is in Asia-Pacific.** Both databases are made in APAC, the bookings are kept in APAC, and both Workers run in
  Tokyo, next to their databases. Run next to the caller instead, each database query from the US took 210 ms.
- **The live tests** (`mise run all:e2e staging`) make two throwaway people in ID. They sign in, book, cancel and sign
  out, and are then deleted. On production the tests only read.
- **Removing ID** leaves one DNS record that Wrangler can't delete: `TXT _dmarc.id[-staging].ubuntusoftware.net`. The
  task tells you to delete it. Every account is lost, and apps get new ids for everyone when ID comes back.

## Signing in: Gateweave ID only

The site has no passwords, no sign-up form and no login form. Making an account, signing in, passwords, two-factor,
passkeys and deleting an account all happen on Gateweave ID's own pages.

- **Sign in** is a plain link to `/sign-in`, which sends you to ID and back. It works before the page's script has
  loaded. If ID refuses, you land on `/login`, which says why in plain words (`src/lib/sign-in-refusal.ts`).
- **Sign out** is a plain form posting to `/sign-out`. It ends your session on this site only. You stay signed in at
  ID, so the next Sign in goes straight through. That's how Gateweave's own apps work too.
- **Sign out everywhere** is on your Gateweave ID account page (linked from Your bookings). ID then tells this site to
  end your sessions too (back-channel logout).
- **What the site keeps:** your ID user id, your name and email (updated at every sign-in), and a short session. None
  of ID's tokens are kept. If ID is down, people already signed in carry on.
- **Why Sign out doesn't sign you out of ID as well:** ID would ask "Confirm logout", and then its own security
  settings stop the browser coming back here, so you'd be stuck on ID's page. Seen on ID v0.10.4, still the same in
  v0.12.0 (issue #7).

The sign-in code is copied from [Gateweave Track](https://github.com/gateweavehq/track) at commit `b8b5ba0`, because
Track's version isn't a package you can install. Each copied file says at the top what it came from and what changed:
`src/server/auth/` (`oidc-sign-in.ts`, `config.ts`, `index.ts`, `workers-address.ts`), `src/server/rate-limit/` and
`src/lib/sign-in-refusal.ts`.

Both the site and ID run on Custom Domains on `ubuntusoftware.net`, because two Workers on `workers.dev` can't reach
each other.

## Designing pages: Hallmark

Hallmark reads a project before it designs anything. These files make it design inside this app, on this design:

- `DESIGN.md`: the design rules. The theme (Grid), its colours and type, and that a page is a route file in
  `src/routes/` with the shared header and footer.
- `src/styles/tokens.css`: Hallmark's colours, sizes and fonts as Tailwind values.
- `src/lib/pages.ts`: the list of pages. It draws the menu and footer, and says which design rules each page is
  checked against (`page` for pages people read, `app` for pages people work in).
- `.claude/skills/hallmark/`: Hallmark itself (v2.0.0, MIT), installed by the `skills` CLI the way Hallmark's README
  says. Hallmark has no releases, so the copy in git is the version we use.

To use it:

```sh
mise run hallmark:page /prices "what the page is for"   # opens Claude to design a new page
mise run hallmark:redesign src/routes/index.tsx         # redesigns a page, keeping its content
mise run hallmark:audit src/routes                      # reports only
mise run hallmark:lint                                  # checks every page
```

The design tasks open the `claude` already on your machine. This repo never installs Claude Code.

Every page is checked against Hallmark's rules on every test run: signed out in CI (`e2e/hallmark.spec.ts`), and
signed in on staging (`mise run all:e2e staging`).

## Keeping versions current

Each thing has a check (reads only) and an update (changes the files). Run `mise run mise-check:verify` after an update,
then commit.

| What               | Its files                        | Check                  | Update                                                                |
| ------------------ | -------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| The app's packages | `package.json`, `aube-lock.yaml` | `mise run deps:check`  | `mise run mise-check:update-packages`                                 |
| node               | `package.json` (`devEngines`)    | `mise run deps:check`  | `mise run node:update`                                                |
| The repo's tools   | `mise.toml`, `mise.lock`         | `mise run tools:check` | `mise run mise-check:update-mise`                                     |
| mise-check         | `.mise/config.toml`              | `mise run mise-check`  | `mise run mise-check:update-mise`, then `mise run mise-check:03-init` |
| Gateweave ID       | `scripts/id-release.mjs`         | `mise run id:check`    | `mise run id:update`                                                  |
| Hallmark           | `.claude/skills/hallmark/`       |                        | `mise run hallmark:update`                                            |

- `id:check` lists newer ID releases with links to their notes, and says if they add database migrations. Read the
  notes before updating. After `id:update`, test it with `mise run all:dev` and `mise run all:e2e development`, then
  deploy it with `mise run id:deploy staging`.
- Packages held back on purpose, and security warnings we've accepted, are listed with their reasons in
  `aube-workspace.yaml`.
- Updates are not in CI, because their answers change whenever something new is published.

## Secrets

- Each secret is made by the task that needs it and put straight into Cloudflare's Worker secrets. It is never
  printed, never saved in a file, never in git.
- A secret that's already set is left alone. `OIDC_PAIRWISE_SECRET` in particular must never change: it is what gives
  each person the same id in each app.
- The secrets: the site's `BETTER_AUTH_SECRET` (`app:deploy`); ID's `BETTER_AUTH_SECRET`, `OIDC_PAIRWISE_SECRET` and
  `TURNSTILE_SECRET_KEY` (`id:deploy`); the site's ID client id and secret (`app:register`).
- Locally they are in `.dev.vars`, which is git-ignored.

## How the code fits together

- **Pages:** `src/routes/` (Home, Book, Courts, Coaching, Visit, Your bookings, Sign in), their parts in
  `src/components/site/`, listed in `src/lib/pages.ts`.
- **Bookings:** one Durable Object per venue (`src/server/venue-do.ts`). A unique index on court, date and hour makes a
  double booking impossible: the second one is refused, and the page says someone took it.
- **Loading and saving:** server functions in `src/lib/bookings.ts`.
- **Accounts and sessions:** Better Auth in D1 (`src/server/auth/`, `migrations/`).
- **Courts** have opaque UUIDs (`src/lib/courts.ts`), never names, so renaming a court can't break a booking.
- **A daily cron** deletes bookings older than a month.
- **Tests:** unit tests in `src/**/*.test.ts`, Workers runtime tests in `test/`, browser tests in `e2e/`, live tests in
  `e2e/live/`. `mise run mise-check:verify` runs exactly what GitHub's CI runs.

## The stack

TanStack Start · React 19 · Tailwind CSS 4 · shadcn/ui · Better Auth · Drizzle ORM · Cloudflare Workers, Durable
Objects and D1 · Vite 8 · TypeScript 7 · Vitest · Playwright · Biome · zod. Tools: mise, aube, mise-check, Pitchfork, Tailscale, Hallmark.

It's the stack of [Gateweave's products](https://github.com/orgs/gateweavehq/repositories), taken from
[gateweavehq/track](https://github.com/gateweavehq/track): the same libraries, at the same versions, wired the same
way, in one package instead of four. Track's realtime sync, MCP, GitHub app, email and organisations are left out,
because a booking site doesn't need them. Different on purpose: aube instead of pnpm, mise for node and tools, and one
`mise run mise-check:verify` instead of several CI jobs.

## Not real yet

- The name Eastfield Courts, the courts, their layout and the coaching timetable are sample content.
- Opening hours and the address are blank (`data-fill` in `src/components/site/sections.tsx`).
- Someone who deletes their Gateweave ID account can't sign in again, but the site keeps their name and email until
  their bookings expire. ID doesn't tell apps when an account is deleted.
- The two photos (`public/images/clay-court.jpg`, `public/images/goal.jpg`) are stand-ins from Hallmark's library,
  credited in the footer.

## Where versions came from

- **Track:** commit `b8b5ba0` (2026-11-06), checked 2026-11-07.
- **Gateweave ID:** release `v0.12.0`, commit `5c4b942`, checked 2026-11-08, in `scripts/id-release.mjs`. Every task
  that uses ID checks the commit.
- **node** `24.22.2` and **aube** `2.9.0`: the newest on 2026-11-07. **mise** `2026.11.3` (`min_version`), **Pitchfork**
  `2.33.1`, **mise-check** `0.4.9`: checked 2026-11-08.
- **`puppeteer-core` is held at 25.12.0.** Hallmark's lint drives Chrome with it. Every later release needs
  `chromium-bidi` 157 or newer, which Google publishes without npm provenance, and aube refuses packages without it.
  Checked 2026-11-07.
- **Biome** has two CSS rules off for `src/styles/`: Hallmark needs `!important` for its reduced-motion rules, and the
  other rule's warnings there are about selectors that never match the same element.
