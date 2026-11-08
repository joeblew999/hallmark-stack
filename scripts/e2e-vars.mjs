// The signed-out suite's server (playwright.config.ts, webServer): the production build, served by `vite preview`, with
// the vars this suite is about and nothing else: a random BETTER_AUTH_SECRET and no Gateweave ID. Cloudflare's Vite
// plugin copies .dev.vars into the build (dist/server/.dev.vars, read at preview), and a developer's .dev.vars has
// their local ID's settings once `mise run all:dev` has run; this replaces that copy, so the suite's server is the
// same on GitHub and on any machine. Signing in through an ID is the live suite's (mise run all:e2e <env>).
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const VARS = "dist/server/.dev.vars";
if (!existsSync("dist/server")) throw new Error("No build in dist/: run aube run build first");
writeFileSync(VARS, `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}\n`);
