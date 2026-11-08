# Commands

Every command in this repo. Written by `mise run docs:update`, so don't edit it by hand: the mise tasks by mise
itself (`mise generate task-docs`), the app's scripts from `package.json`.

## mise tasks

Everything a developer runs: running it locally, checks and tests (`mise run test`), Cloudflare, Gateweave ID, Hallmark,
and keeping versions current. From `mise.toml`.

<!-- mise-tasks -->
## `all:deploy`

Deploys Gateweave ID and the site, connects them, then tests them


- Depends: app:register {{usage.env}}

- **Usage:** `all:deploy <env>`

### Arguments
- **`<env>`** — staging or production

  **Choices:** `staging`, `production`

## `all:dev`

- **Usage:** `all:dev`

Starts Gateweave ID and the site on this machine, on public addresses, signed in together. They keep running: mise daemons logs, mise daemons stop

## `all:e2e`

Tests the running site end to end in Chrome: sign in, book, cancel, sign out. Production only reads


- **Usage:** `all:e2e <env>`

### Arguments
- **`<env>`** — staging, production or development

  **Choices:** `staging`, `production`, `development`

## `all:undeploy`

Removes the site, then Gateweave ID


- Depends: app:undeploy {{usage.env}}

- **Usage:** `all:undeploy <env>`

### Arguments
- **`<env>`** — staging or production

  **Choices:** `staging`, `production`

## `app:deploy`

Deploys the site to staging or production


- **Usage:** `app:deploy <env>`

### Arguments
- **`<env>`** — staging or production

  **Choices:** `staging`, `production`

## `app:register`

Connects the site to its Gateweave ID so people can sign in. Runs both deploys first


- Depends: id:deploy {{usage.env}}, app:deploy {{usage.env}}

- **Usage:** `app:register <env>`

### Arguments
- **`<env>`** — staging, production or development

  **Choices:** `staging`, `production`, `development`

## `app:undeploy`

Removes the site from staging or production. Asks first: its bookings are lost


- **Usage:** `app:undeploy <env>`

### Arguments
- **`<env>`** — staging or production

  **Choices:** `staging`, `production`

## `cloudflare:login`

- **Usage:** `cloudflare:login`

Logs this repo in to Cloudflare. Prints a link to approve, then waits

## `cloudflare:logout`

- **Usage:** `cloudflare:logout`

Logs this repo out of Cloudflare

## `deps:check`

- **Usage:** `deps:check`

Lists app packages that are out of date or have security warnings

## `docs:check`

- **Usage:** `docs:check`

Fails if docs/commands.md is out of date. Fix it with mise run docs:update

## `docs:update`

- **Usage:** `docs:update`

Rewrites docs/commands.md: the mise tasks (written by mise) and the app's scripts

## `hallmark:audit`

Opens Claude to review a page with Hallmark. Reports only, changes nothing


- **Usage:** `hallmark:audit <path>`

### Arguments
- **`<path>`** — the route file or folder to audit, such as src/routes

## `hallmark:lint`

- **Usage:** `hallmark:lint`

Builds the site and checks every page against Hallmark's design rules

## `hallmark:page`

Opens Claude to design a new page with Hallmark, then lints it


- **Usage:** `hallmark:page [--scope <scope>] <route> <brief>`

### Arguments
- **`<route>`** — the new page's route, such as /prices
- **`<brief>`** — what the page is for and what goes on it, in your words

### Flags
- **`--scope <scope>`** — page (read: marketing gates) or app (worked in: app gates)

  **Choices:** `page`, `app`

  **Default:** `page`

## `hallmark:redesign`

Opens Claude to redesign an existing page with Hallmark, keeping its content, then lints it


- **Usage:** `hallmark:redesign <path>`

### Arguments
- **`<path>`** — the route file or folder to redesign, such as src/routes/index.tsx

## `hallmark:update`

- **Usage:** `hallmark:update`

Updates Hallmark to its newest version, then lints every page

## `id:check`

- **Usage:** `id:check`

Lists Gateweave ID releases newer than the one we use, with links to their notes, and says if they change the database

## `id:claim`

Makes you the owner of a new Gateweave ID. Prints its address and waits for you to create your account


- **Usage:** `id:claim <env>`

### Arguments
- **`<env>`** — staging, production or development

  **Choices:** `staging`, `production`, `development`

## `id:deploy`

Deploys Gateweave ID to staging or production


- **Usage:** `id:deploy <env>`

### Arguments
- **`<env>`** — staging or production

  **Choices:** `staging`, `production`

## `id:undeploy`

Removes Gateweave ID from staging or production. Asks first: its accounts are lost


- **Usage:** `id:undeploy <env>`

### Arguments
- **`<env>`** — staging or production

  **Choices:** `staging`, `production`

## `id:update`

- **Usage:** `id:update`

Moves us to the newest Gateweave ID release. Then mise run mise-check:verify; deploy it with id:deploy

## `mise-check`

Start here: what's done for this repo, and what to run next (mise run mise-check:show-help: every command)


- **Usage:** `mise-check [--json]`

### Flags
- **`--json`** — one JSON document on stdout, instead of text

## `mise-check:03-init`

- **Usage:** `mise-check:03-init`

03. mise-check's files written into the repo again, after upgrading it (the first time, before these tasks: mise exec github:joeblew999/mise-check@latest -- mise-check init)

## `mise-check:04-check`

04. The repo's rules: init's files current, and .mise/config.toml pinning mise-check


- **Usage:** `mise-check:04-check [--json]`

### Flags
- **`--json`** — one JSON document on stdout, instead of text

## `mise-check:05-show`

05. What's done for this repo, and what to run next


- **Usage:** `mise-check:05-show [--json]`

### Flags
- **`--json`** — one JSON document on stdout, instead of text

## `mise-check:show-help`

- **Usage:** `mise-check:show-help`

Every command

## `mise-check:show-users`

Which of the owner's repos on GitHub use this one: its Go module in their go.mod, its binary in their mise files, at the versions each pins, against the newest release, the behind ones marked. Needs a token for private repos (GITHUB_TOKEN, GH_TOKEN, or gh's login)


- **Usage:** `mise-check:show-users [--json]`

### Flags
- **`--json`** — one JSON document on stdout, instead of text

## `mise-check:show-version`

This mise-check's version


- **Usage:** `mise-check:show-version [--json]`

### Flags
- **`--json`** — one JSON document on stdout, instead of text

## `mise-check:template`

- **Usage:** `mise-check:template`

The template's little app, in a repo with no Go program yet: app/, the mise.toml that runs and tests it, and README.md named for the repo's folder. It never writes over a file

## `mise-check:update`

Every pin at its newest release, in one go: update-mise, update-packages and update-go, in that order. It ends with every pin, the moved ones before → after; git diff shows them, then mise run mise-check:verify proves them (a major move can break)


- **Usage:** `mise-check:update [FLAGS]`

### Flags
- **`--pick`** — ask for each one, with the picker of each tool
- **`--no-major`** — no major moves: packages within their ranges, Go modules within their major
- **`--json`** — one JSON document on stdout, every pin before and after, instead of text

## `mise-check:update-go`

Go at its newest, in every go.mod: its toolchain line, and its modules, majors too, their import paths rewritten (go mod tidy, go-mod-upgrade, go mod tidy), and nothing else


- **Usage:** `mise-check:update-go [FLAGS]`

### Flags
- **`--pick`** — ask for each one, with the picker of each tool
- **`--no-major`** — no major moves: packages within their ranges, Go modules within their major
- **`--json`** — one JSON document on stdout, every pin before and after, instead of text

## `mise-check:update-mise`

The mise tools at their newest releases, in the repo's mise files (mise upgrade --bump), mise-check's own pin among them, and nothing else


- **Usage:** `mise-check:update-mise [FLAGS]`

### Flags
- **`--pick`** — ask for each one, with the picker of each tool
- **`--no-major`** — no major moves: packages within their ranges, Go modules within their major
- **`--json`** — one JSON document on stdout, every pin before and after, instead of text

## `mise-check:update-packages`

The Node packages at their newest releases, package.json and whichever lockfile the repo has (aube update, aube pinned in the repo's mise), and nothing else


- **Usage:** `mise-check:update-packages [FLAGS]`

### Flags
- **`--pick`** — ask for each one, with the picker of each tool
- **`--no-major`** — no major moves: packages within their ranges, Go modules within their major
- **`--json`** — one JSON document on stdout, every pin before and after, instead of text

## `mise-check:verify`

- **Usage:** `mise-check:verify`

What the repo's GitHub workflow runs: each pin consistent with what pins it (the packages with their lockfile, aube install --frozen-lockfile; every go.mod with its code, go mod tidy -diff), its own setup and test tasks if it has them, then check. The same here as on GitHub

## `node:update`

- **Usage:** `node:update`

Moves node to its newest 24.x, in package.json (devEngines.runtime). Then mise run mise-check:verify

## `setup`

- **Usage:** `setup`

Installs the app's packages (mise runs this itself before any task when they changed)

## `tailscale:login`

- **Usage:** `tailscale:login`

Puts the local site and Gateweave ID on public https addresses through Tailscale. Prints sign-in links, then waits

## `tailscale:logout`

- **Usage:** `tailscale:logout`

Takes the local site off Tailscale. The machines stay in your Tailscale list until you remove them there

## `test`

- **Usage:** `test`

Runs every check and test, in order. GitHub runs this too, through mise run mise-check:verify

## `tools:check`

- **Usage:** `tools:check`

Lists tools in mise.toml that are out of date
<!-- /mise-tasks -->

## The app's scripts

From `package.json`. The mise tasks run these; you can run one on its own with `aube run <name>`.

<!-- app-scripts -->
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
| `aube run config:check` | Checks that the staging and production config is complete | `node scripts/config-check.mjs` |
<!-- /app-scripts -->
