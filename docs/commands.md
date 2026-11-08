# Commands

Every command in this repo. Generated from `mise.toml` and `package.json` by `aube run commands`, so don't edit it by
hand. If `aube` isn't found, put `mise exec --` in front, or activate mise in your shell.

## mise tasks

Everything outside the app itself: running it locally, Cloudflare, Gateweave ID, Hallmark, and keeping versions
current. From `mise.toml`.

| Command | What it's for |
| --- | --- |
| `mise run deps:check` | Lists app packages that are out of date or have security warnings |
| `mise run deps:update` | Updates the app's packages and node to the newest versions. Run aube run ci afterwards |
| `mise run tools:check` | Lists tools in mise.toml that are out of date |
| `mise run tools:update` | Updates the tools in mise.toml to the newest versions. Run aube run ci afterwards |
| `mise run id:check` | Lists Gateweave ID releases newer than the one we use, with links to their notes, and says if they change the database |
| `mise run id:update` | Moves us to the newest Gateweave ID release. Run aube run ci afterwards; deploy it with id:deploy |
| `mise run hallmark:page <route> <brief>` | Opens Claude to design a new page with Hallmark, then lints it |
| `mise run hallmark:redesign <path>` | Opens Claude to redesign an existing page with Hallmark, keeping its content, then lints it |
| `mise run hallmark:audit <path>` | Opens Claude to review a page with Hallmark. Reports only, changes nothing |
| `mise run hallmark:lint` | Builds the site and checks every page against Hallmark's design rules |
| `mise run hallmark:update` | Updates Hallmark to its newest version, then lints every page |
| `mise run cloudflare:login` | Logs this repo in to Cloudflare. Prints a link to approve, then waits |
| `mise run cloudflare:logout` | Logs this repo out of Cloudflare |
| `mise run tailscale:login` | Puts the local site and Gateweave ID on public https addresses through Tailscale. Prints sign-in links, then waits |
| `mise run tailscale:logout` | Takes the local site off Tailscale. The machines stay in your Tailscale list until you remove them there |
| `mise run all:dev` | Runs Gateweave ID and the site on this machine, on public addresses, signed in together |
| `mise run id:deploy <env>` | Deploys Gateweave ID to staging or production |
| `mise run id:claim <env>` | Makes you the owner of a new Gateweave ID. Prints its address and waits for you to create your account |
| `mise run app:deploy <env>` | Deploys the site to staging or production |
| `mise run app:register <env>` | Connects the site to its Gateweave ID so people can sign in. Runs both deploys first |
| `mise run all:deploy <env>` | Deploys Gateweave ID and the site, connects them, then tests them |
| `mise run all:e2e <env>` | Tests the running site end to end in Chrome: sign in, book, cancel, sign out. Production only reads |
| `mise run app:undeploy <env>` | Removes the site from staging or production. Its bookings are lost |
| `mise run id:undeploy <env>` | Removes Gateweave ID from staging or production. Its accounts are lost |
| `mise run all:undeploy <env>` | Removes the site, then Gateweave ID |

## The app's scripts

From `package.json`.

| Command | What it's for | Runs |
| --- | --- | --- |
| `aube run dev` | Runs the site alone on http://localhost:4710, signed out unless a Gateweave ID is running | `vite dev --port 4710 --strictPort` |
| `aube run build` | Builds the site for production into dist/ | `vite build` |
| `aube run preview` | Serves the production build on http://localhost:4711 | `vite preview --port 4711 --strictPort` |
| `aube run snapshot` | Saves every page of the build as plain HTML files in dist/snapshot/, for viewing without a server | `node scripts/snapshot.mjs` |
| `aube run typegen` | Regenerates the Worker types and the route list | `wrangler types && tsr generate` |
| `aube run typecheck` | Checks the TypeScript of the app and its tests | `wrangler types && tsr generate && tsc && tsc -p test` |
| `aube run check` | Checks formatting and lint with Biome | `biome check` |
| `aube run format` | Fixes formatting and simple lint problems with Biome | `biome check --write` |
| `aube run test` | Runs the unit tests, and the bookings tests in the real Workers runtime | `vitest run` |
| `aube run test:e2e` | Tests the production build in Chrome, signed out: every page, booking, the sign-in link, and Hallmark on every page | `playwright test` |
| `aube run hallmark` | Checks every page of the production build against Hallmark design rules (build first) | `playwright test e2e/hallmark.spec.ts` |
| `aube run auth:schema` | Regenerates the Better Auth database tables from the auth config | `auth generate --config src/server/auth/cli.ts --output src/server/db/auth-schema.ts --yes` |
| `aube run db:generate` | Writes a database migration from the schema | `drizzle-kit generate` |
| `aube run db:migrate:local` | Applies database migrations to the local database | `wrangler d1 migrations apply DB --local` |
| `aube run dev:setup` | First-time setup: writes .dev.vars with a random secret and sets up the local database | `node scripts/dev-setup.mjs` |
| `aube run ci` | Runs everything CI runs, in the same order. GitHub runs exactly this | `aube run commands --check && aube run check && aube run config:check && aube run typecheck && aube run test && aube run dev:setup && aube run build && aube run test:e2e` |
| `aube run config:check` | Checks that the staging and production config is complete | `node scripts/config-check.mjs` |
| `aube run commands` | Regenerates docs/commands.md (--check fails if it is out of date) | `node scripts/commands.mjs` |
