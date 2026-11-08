# Commands

Generated from `mise.toml` and `package.json` by `aube run commands`; don't edit by hand. Tools are pinned in `mise.toml`, node in
`package.json` (`devEngines.runtime`), both installed by `mise install`; packages installed with `aube install`. With mise activated in your shell, `aube` is on the
path; otherwise prefix `mise exec --`.

## mise: the control plane

What sits outside this app: Cloudflare and Gateweave ID, and keeping versions current (README, Keeping versions
current). From the root `mise.toml`.

| Command | What it's for |
| --- | --- |
| `mise run deps:check` | Are the app's packages behind or unsafe? Lists anything new; held packages and accepted advisories are in aube-workspace.yaml |
| `mise run deps:update` | Move the app's packages and node to their newest, as exact pins. Then run aube run ci |
| `mise run tools:check` | Are the tools in mise.toml behind? |
| `mise run tools:update` | Move the tools in mise.toml to their newest, as exact pins. Then run aube run ci |
| `mise run hallmark:page <route> <brief>` | A new page, designed by Hallmark in this stack: opens claude with /hallmark asking for the route as src/routes/<route>.tsx at its scope, from your brief, inside DESIGN.md (shared header and footer, added to src/lib/pages.ts), then hallmark:lint |
| `mise run hallmark:redesign <path>` | Hallmark's redesign of what exists, keeping its content and wiring: opens claude with /hallmark redesign <path>, inside DESIGN.md, then hallmark:lint |
| `mise run hallmark:audit <path>` | Hallmark's audit: opens claude with /hallmark audit <path>, which only reports |
| `mise run hallmark:lint` | Hallmark's own lint on every route, rendered from the production build at Hallmark's widths, each at its scope in src/lib/pages.ts (aube run build, then aube run hallmark); fails on anything but clean |
| `mise run hallmark:update` | Hallmark to upstream's newest, the way its README installs it: the skills CLI (pinned above) copies Nutlope/hallmark's skill into .claude/skills/hallmark/ for Claude Code and records it in skills-lock.json (its source and content hash); then hallmark:lint. Upstream has no releases, so the copy in git is the pin, and only this task moves it |
| `mise run cloudflare:login` | Cloudflare login for this repo (Wrangler's device-code flow): prints the approval link with the code on it, waits, then says who is logged in; already logged in, it just says who |
| `mise run cloudflare:logout` | End this repo's Cloudflare login (wrangler logout: the token is revoked and deleted here); not logged in, it says so |
| `mise run tailscale:login` | Development on the internet, through Tailscale Funnel on 443: two Tailscale machines from this repo (its own tailscaled for each, state in .tailscale/), courts as hallmark-stack-<host> and Gateweave ID as hallmark-stack-id-<host>; prints each one's sign-in link and waits, then any Funnel approval link and waits, then says where both are (https://<name>.<tailnet>.ts.net); already signed in, it just says where. all:dev runs it (scripts/tailscale.mjs) |
| `mise run tailscale:logout` | Development off Tailscale: Funnel off and signed out on both machines, this repo's tailscaled stopped and .tailscale/ removed (scripts/tailscale.mjs) |
| `mise run all:dev` | Development, the same pair as staging and production, on this machine and on the internet: Gateweave ID (pinned, set up by its own dev:setup) and courts, each a Worker in workerd with its own local D1; tailscale:login puts them on https://hallmark-stack-<host>.<tailnet>.ts.net (courts) and https://hallmark-stack-id-<host>.<tailnet>.ts.net (ID) through Tailscale Funnel; courts registered with that ID by app:register's own steps, its settings in .dev.vars; waits until courts' sign-in reaches ID's login page over the internet. Opened from any browser; nothing reaches Cloudflare. A new local ID is claimed once: mise run id:claim development (scripts/dev.mjs) |
| `mise run id:deploy <env>` | One environment's Gateweave ID (pinned v0.11.4) onto Cloudflare as id-<env>, at its address in id.jsonc, by ID's own deploy script, set up for the internet: email from its own name (Email Sending), its D1 made in Asia-Pacific, its Turnstile, the breached-password check; OIDC_PAIRWISE_SECRET and TURNSTILE_SECRET_KEY set once, kept by Cloudflare, never printed; waits until its provider answers, then id:claim, then opens sign-up (scripts/id-deploy.mjs) |
| `mise run id:claim <env>` | Who owns one environment's Gateweave ID: a new server prints its address and waits up to 10 minutes for you to use Create account there in the browser, with the code ID emails you (the first account owns it); the owner must be your Cloudflare login's email, or it stops (scripts/id-claim.mjs) |
| `mise run app:deploy <env>` | One environment's courts onto Cloudflare as courts-<env>, at its route in wrangler.jsonc: its D1 made in Asia-Pacific on the first deploy, build, D1 migrations before new code, BETTER_AUTH_SECRET made once and never printed; waits until the site answers (scripts/app-deploy.mjs) |
| `mise run app:register <env>` | One environment's courts registers itself with that environment's Gateweave ID, after id:deploy and app:deploy; its client id and secret go straight into its Worker secrets, never printed; registered only if ID has its client and it has the settings, otherwise it registers again; then proves sign-in reaches ID's login page (scripts/app-register.mjs) |
| `mise run all:deploy <env>` | One environment onto Cloudflare: app:register, which mise runs after id:deploy and app:deploy; then all:e2e proves it |
| `mise run all:e2e <env>` | One environment's live courts site through its live Gateweave ID, in Chrome, no human (Playwright, playwright.live.config.ts, e2e/live/): two throwaway people invited into ID sign in, courts keeps none of ID's tokens, a double booking is refused, a cancel frees it, Hallmark's lint passes on the signed-in pages, courts takes the name from ID again at the next sign-in, courts' Sign out leaves ID signed in, signing out at ID ends courts' session; read-only checks that both answer and are paired; then the people are deleted. Staging runs it all; production only the read-only checks: nobody made, nothing booked; development all of it, against mise run all:dev on this machine |
| `mise run app:undeploy <env>` | One environment's courts off Cloudflare, every piece: its registration with Gateweave ID, its Worker (domain, Durable Object, secrets, cron) and its D1; accounts and bookings gone for good (scripts/app-undeploy.mjs) |
| `mise run id:undeploy <env>` | One environment's Gateweave ID off Cloudflare, every piece: its Worker (domain, secrets, OIDC_PAIRWISE_SECRET included), its D1, its logouts queue, its Turnstile widget and Email Sending for its name; every account gone, and every app's ids change when it comes back (scripts/id-undeploy.mjs) |
| `mise run all:undeploy <env>` | One environment off Cloudflare, in order: app:undeploy, id:undeploy |

## The app

| Command | What it's for | Runs |
| --- | --- | --- |
| `aube run dev` | Run the app on http://localhost:4710 (the Worker in workerd, D1 and the Durable Object local) | `vite dev --port 4710 --strictPort` |
| `aube run build` | Production build into dist/ | `vite build` |
| `aube run preview` | Serve the production build on http://localhost:4711 | `vite preview --port 4711 --strictPort` |
| `aube run snapshot` | Save every page of the build as static files in dist/snapshot/ (index.html and <page>.html, linked to each other), for the artifact viewer | `node scripts/snapshot.mjs` |
| `aube run typegen` | Regenerate the Worker's types (worker-configuration.d.ts) and the route tree | `wrangler types && tsr generate` |
| `aube run typecheck` | Type-check the app and the tests (regenerates types first) | `wrangler types && tsr generate && tsc && tsc -p test` |
| `aube run check` | Biome lint and format check | `biome check` |
| `aube run format` | Biome: fix formatting and safe lint fixes | `biome check --write` |
| `aube run test` | Vitest: unit tests in Node, and the Durable Object in workerd with the real wrangler.jsonc | `vitest run` |
| `aube run test:e2e` | Playwright on the production build (after aube run build) in installed Chrome, with nobody signed in and no Gateweave ID (scripts/e2e-vars.mjs): the pages and the nav between them, the booker, the sign-in button, no passwords, and Hallmark's lint on every route. Signed in, through a real Gateweave ID, is mise run all:e2e <env> | `playwright test` |
| `aube run hallmark` | Just the Hallmark spec of test:e2e: Hallmark's sloplint on the rendered production build (after aube run build), every route at its scope (src/lib/pages.ts) and its widths; fails on anything but clean | `playwright test e2e/hallmark.spec.ts` |
| `aube run auth:schema` | Regenerate the Better Auth tables (src/server/db/auth-schema.ts) from src/server/auth/config.ts | `auth generate --config src/server/auth/cli.ts --output src/server/db/auth-schema.ts --yes` |
| `aube run db:generate` | Drizzle: write a migration into migrations/ from the schema | `drizzle-kit generate` |
| `aube run db:migrate:local` | Apply migrations to the local D1 | `wrangler d1 migrations apply DB --local` |
| `aube run dev:setup` | One-time: write .dev.vars with a random BETTER_AUTH_SECRET and migrate the local D1 | `node scripts/dev-setup.mjs` |
| `aube run ci` | Everything CI runs, in order: check, typecheck, test, dev:setup (the build carries .dev.vars to the built Worker), build, test:e2e (Hallmark's lint included). GitHub runs exactly this | `aube run commands --check && aube run check && aube run config:check && aube run typecheck && aube run test && aube run dev:setup && aube run build && aube run test:e2e` |
| `aube run config:check` | Every environment's config whole (staging, production): courts in wrangler.jsonc, Gateweave ID in id.jsonc; read back as Wrangler will, no build, no login | `node scripts/config-check.mjs` |
| `aube run commands` | Regenerate docs/commands.md from these scripts (--check fails if it is out of date) | `node scripts/commands.mjs` |
