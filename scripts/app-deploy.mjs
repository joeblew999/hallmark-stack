// mise run app:deploy <env>: this app onto Cloudflare as courts-<env>, at its Custom Domain in wrangler.jsonc. The
// same order Gateweave ID's own deploy script uses:
//
//   1. The environment (scripts/environments.mjs: CLOUDFLARE_ENV for every command after) and the Cloudflare login.
//   2. Its D1, if it isn't there yet, made in its LOCATION (Asia-Pacific, issue #5): a D1 can't be moved later, and
//      left to `wrangler deploy` it is made next to whoever deploys.
//   3. The build for that environment (vite build, which takes CLOUDFLARE_ENV).
//   4. The D1 migrations, then the new code, so it never meets an old schema. A new Worker's BETTER_AUTH_SECRET is made
//      here and passed in a file deleted straight after (Wrangler takes a new Worker's secrets only as a file).
//   5. Waits until Better Auth's own health route answers on its real address. It touches no D1 and no Durable
//      Object, so the deploy doesn't make the venue's object from wherever the deploy runs.
//
// Secrets follow the README's Secrets section.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appConfig } from "./app-config.mjs";
import { waitUntilUp } from "./cloudflare.mjs";
import { chooseEnvironment } from "./environments.mjs";

const env = chooseEnvironment();
const { worker, database, domain, location } = appConfig(env);
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const wrangler = (args) => run("wrangler", args);

run("node", ["scripts/cloudflare-login.mjs"]);

const databases = JSON.parse(
	execFileSync("wrangler", ["d1", "list", "--json"], { encoding: "utf8" }),
);
if (databases.some(({ name }) => name === database)) {
	console.log(`The D1 database ${database} is already there; left as it is.`);
} else {
	// --update-config=false: wrangler.jsonc names each D1 by name only, so the file is left as it is.
	wrangler(["d1", "create", database, "--location", location, "--update-config=false"]);
}

run("vite", ["build"]);
const workerExists =
	spawnSync("wrangler", ["secret", "list", "--format", "json"], { stdio: "ignore" }).status === 0;
wrangler(["d1", "migrations", "apply", "DB", "--remote"]);
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
await waitUntilUp(worker, `https://${domain}/api/auth/ok`, (response, body) => {
	try {
		return response.ok && JSON.parse(body).ok === true;
	} catch {
		return false;
	}
});
console.log(`\n${worker} is on https://${domain}.\n`);
