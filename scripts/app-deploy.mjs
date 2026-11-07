// mise run app:deploy: this app onto Cloudflare, at courts.ubuntusoftware.net (the Custom Domain in wrangler.jsonc).
// The same order Gateweave ID's own deploy script uses:
//
//   1. The Cloudflare login (scripts/cloudflare-login.mjs: already logged in, it says as whom).
//   2. The production build (vite build).
//   3. A later deploy: the D1 migrations first, then the new code, so it never meets an old schema.
//      The first deploy: `wrangler deploy` creates the D1 database and the Worker, with a BETTER_AUTH_SECRET made here
//      and passed in a file deleted straight after (Wrangler takes a new Worker's secrets only as a file); then the
//      migrations.
//
// Secrets follow the README's Secrets section.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const wrangler = (args) => run("wrangler", args);
const config = readFileSync("wrangler.jsonc", "utf8");
const workerName = /"name":\s*"([^"]+)"/.exec(config)?.[1];
const databaseName = /"database_name":\s*"([^"]+)"/.exec(config)?.[1];
const appDomain = /"pattern":\s*"([^"]+)"/.exec(config)?.[1];
if (!workerName || !databaseName || !appDomain) {
	throw new Error(
		"wrangler.jsonc needs the Worker's name, its D1 database_name and its route pattern",
	);
}

run("node", ["scripts/cloudflare-login.mjs"]);
run("vite", ["build"]);

const databases = JSON.parse(
	execFileSync("wrangler", ["d1", "list", "--json"], { encoding: "utf8" }),
);
const databaseExists = databases.some(({ name }) => name === databaseName);
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
console.log(`\n${workerName} is on https://${appDomain}.\n`);
