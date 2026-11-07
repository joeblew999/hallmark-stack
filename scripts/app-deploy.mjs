// mise run app:deploy: this app onto Cloudflare, at courts.ubuntusoftware.net (the Custom Domain in wrangler.jsonc).
// The same order Gateweave ID's own deploy script uses:
//
//   1. The Cloudflare login (scripts/cloudflare-login.mjs: already logged in, it says as whom).
//   2. The production build (vite build).
//   3. A later deploy: the D1 migrations first, then the new code, so it never meets an old schema.
//      The first deploy: `wrangler deploy` creates the D1 database and the Worker, with a BETTER_AUTH_SECRET made here
//      and passed in a file deleted straight after (Wrangler takes a new Worker's secrets only as a file); then the
//      migrations.
//   4. Waits until the site answers 200 on its real address.
//
// Secrets follow the README's Secrets section.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_DATABASE, APP_DOMAIN, APP_WORKER } from "./app-config.mjs";
import { waitUntilUp } from "./cloudflare.mjs";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const wrangler = (args) => run("wrangler", args);

run("node", ["scripts/cloudflare-login.mjs"]);
run("vite", ["build"]);

const databases = JSON.parse(
	execFileSync("wrangler", ["d1", "list", "--json"], { encoding: "utf8" }),
);
const databaseExists = databases.some(({ name }) => name === APP_DATABASE);
const workerExists =
	spawnSync("wrangler", ["secret", "list", "--format", "json"], { stdio: "ignore" }).status === 0;
const migrate = () => wrangler(["d1", "migrations", "apply", "DB", "--remote"]);

if (databaseExists) migrate();
if (workerExists) {
	wrangler(["deploy"]);
} else {
	const directory = mkdtempSync(join(tmpdir(), "app-deploy-"));
	const secrets = join(directory, "secrets.json");
	try {
		writeFileSync(
			secrets,
			JSON.stringify({ BETTER_AUTH_SECRET: randomBytes(32).toString("base64") }),
			{
				mode: 0o600,
			},
		);
		wrangler(["deploy", "--secrets-file", secrets]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
if (!databaseExists) migrate();
await waitUntilUp(APP_WORKER, `https://${APP_DOMAIN}`);
console.log(`\n${APP_WORKER} is on https://${APP_DOMAIN}.\n`);
