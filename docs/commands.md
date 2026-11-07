# Commands

Generated from `package.json` by `aube run commands`; don't edit by hand. Tools are pinned in `mise.toml`
(`mise install`), packages installed with `aube install`. With mise activated in your shell, `aube` is on the
path; otherwise prefix `mise exec --`.

| Command | What it's for | Runs |
| --- | --- | --- |
| `aube run dev` | Run the app on http://localhost:4710 (the Worker in workerd, D1 and the Durable Object local) | `vite dev --port 4710 --strictPort` |
| `aube run build` | Production build into dist/ | `vite build` |
| `aube run preview` | Serve the production build on http://localhost:4711 | `vite preview --port 4711 --strictPort` |
| `aube run snapshot` | Save the built home page as static files in dist/snapshot/, for the artifact viewer | `node scripts/snapshot.mjs` |
| `aube run deploy` | Build and deploy to Cloudflare (run db:migrate:remote first when migrations change) | `vite build && wrangler deploy` |
| `aube run typegen` | Regenerate the Worker's types (worker-configuration.d.ts) and the route tree | `wrangler types && tsr generate` |
| `aube run typecheck` | Type-check the app and the tests (regenerates types first) | `wrangler types && tsr generate && tsc && tsc -p test` |
| `aube run check` | Biome lint and format check | `biome check` |
| `aube run format` | Biome: fix formatting and safe lint fixes | `biome check --write` |
| `aube run test` | Vitest: unit tests in Node, and the Durable Object in workerd | `vitest run` |
| `aube run test:e2e` | Playwright on the production build in installed Chrome: sign up, book, double booking refused, cancel | `playwright test` |
| `aube run hallmark` | Hallmark's sloplint on the rendered production build at eight widths; fails on anything but clean | `node scripts/dev-setup.mjs && node scripts/hallmark.mjs` |
| `aube run auth:schema` | Regenerate the Better Auth tables (src/server/db/auth-schema.ts) from src/server/auth/config.ts | `aube dlx auth@1.7.16 generate --config src/server/auth/cli.ts --output src/server/db/auth-schema.ts --yes` |
| `aube run db:generate` | Drizzle: write a migration into migrations/ from the schema | `drizzle-kit generate` |
| `aube run db:migrate:local` | Apply migrations to the local D1 | `wrangler d1 migrations apply DB --local` |
| `aube run db:migrate:remote` | Apply migrations to the deployed D1 | `wrangler d1 migrations apply DB --remote` |
| `aube run dev:setup` | One-time: write .dev.vars with a random BETTER_AUTH_SECRET and migrate the local D1 | `node scripts/dev-setup.mjs` |
| `aube run ci` | Everything CI runs, in order: check, typecheck, test, build, test:e2e, hallmark. GitHub runs exactly this | `aube run commands --check && aube run check && aube run typecheck && aube run test && aube run build && aube run test:e2e && aube run hallmark` |
| `aube run commands` | Regenerate docs/commands.md from these scripts (--check fails if it is out of date) | `node scripts/commands.mjs` |
