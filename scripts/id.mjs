// Deploys Gateweave ID (github.com/gateweavehq/id), the sign-in this app uses, to Cloudflare, and registers this app
// with it. ID runs on Cloudflare only, on its own Worker. Run: mise run id:deploy
//
//   1. The Cloudflare login (scripts/cloudflare-login.mjs: already logged in, it says as whom).
//   2. ID's pinned release into the git-ignored vendor/gateweave-id, its packages installed with aube from ID's own
//      pnpm-lock.yaml (no pnpm).
//   3. ID's own deploy script, as the "Deploy to Cloudflare" button would: it builds, creates ID's D1 if missing,
//      applies its migrations and, on the first deploy, sets its BETTER_AUTH_SECRET, never shown. ID answers on its
//      Workers Custom Domain, with that address pinned as its issuer.
//   4. This app registered with ID as a first-party client: the client id and secret go straight into this app's
//      Worker secrets (with OIDC_ISSUER), never printed. Registering again replaces the old secret.
//
// Step 4 needs this app's Worker to exist (aube run deploy). Without it, this stops before registering, so no secret is
// made and lost: deploy this app, then run it again.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** ID's release, from github.com/gateweavehq/id/releases; checked 2026-11-07 (commit bd1d4e6). */
const ID_RELEASE = "v0.10.4";
/** Where ID and this app answer: Workers Custom Domains on ubuntusoftware.net (issue #2). */
const ID_DOMAIN = "id.ubuntusoftware.net";
const APP_DOMAIN = "courts.ubuntusoftware.net";
/** This app's id at ID, and its name on ID's pages. */
const APP_ID = "courts";
const APP_NAME = "Eastfield Courts";

const ROOT = "vendor/gateweave-id";
const WEB = join(ROOT, "apps/web");
const run = (cmd, args, cwd = ".") => execFileSync(cmd, args, { cwd, stdio: "inherit" });

// 1. The login.
run("node", ["scripts/cloudflare-login.mjs"]);

// 2. The pinned release.
const at = existsSync(ROOT)
	? spawnSync("git", ["describe", "--tags", "--exact-match"], {
			cwd: ROOT,
			encoding: "utf8",
		}).stdout.trim()
	: "";
if (at !== ID_RELEASE) {
	rmSync(ROOT, { recursive: true, force: true });
	run("git", [
		"-c",
		"advice.detachedHead=false",
		"clone",
		"--depth",
		"1",
		"--branch",
		ID_RELEASE,
		"https://github.com/gateweavehq/id",
		ROOT,
	]);
}
run("aube", ["install", "--frozen-lockfile"], ROOT);

// 3. ID's deploy. Its wrangler.jsonc has no route and no pinned address; give it its Custom Domain, and pin
// BETTER_AUTH_URL so its issuer is that address. The fetched copy is git-ignored.
const config = join(ROOT, "wrangler.jsonc");
const text = readFileSync(config, "utf8");
if (!text.includes(ID_DOMAIN)) {
	writeFileSync(
		config,
		text.replace(
			/("name":\s*"gateweave-id",)/,
			`$1\n\t"routes": [{ "pattern": "${ID_DOMAIN}", "custom_domain": true }],\n\t"vars": { "BETTER_AUTH_URL": "https://${ID_DOMAIN}" },`,
		),
	);
}
run("node", ["scripts/deploy.mjs"], WEB);
console.log(
	`\nGateweave ID is on https://${ID_DOMAIN}. Sign up there now: the first account owns the server.\n`,
);

// 4. This app, registered.
const appName = /"name":\s*"([^"]+)"/.exec(readFileSync("wrangler.jsonc", "utf8"))?.[1] ?? "";
if (
	spawnSync("wrangler", ["deployments", "list", "--name", appName], { stdio: "ignore" }).status !==
	0
) {
	console.log(
		`This app's Worker (${appName}) isn't deployed yet, so it isn't registered with ID. Deploy it, then run mise run id:deploy again.`,
	);
	process.exit(0);
}
const wranglerD1 = (sql) =>
	execFileSync(
		"node",
		["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--remote", "--command", sql],
		{
			cwd: WEB,
			stdio: ["ignore", "ignore", "inherit"],
		},
	);
wranglerD1(
	`DELETE FROM oauth_client WHERE json_extract(metadata, '$.app') = '${APP_ID}' AND reference_id IS NULL`,
);
const out = execFileSync(
	"node",
	[
		"scripts/add-app.ts",
		"--app",
		APP_ID,
		"--name",
		APP_NAME,
		"--redirect-uri",
		`https://${APP_DOMAIN}/api/auth/callback/oidc`,
		"--backchannel-logout-uri",
		`https://${APP_DOMAIN}/api/auth/backchannel-logout/oidc`,
	],
	{ cwd: WEB, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
const clientId = /client id:\s+(\S+)/.exec(out)?.[1];
const clientSecret = /client secret:\s+(\S+)/.exec(out)?.[1];
if (!clientId || !clientSecret) throw new Error("ID's apps:add printed no client id and secret");
execFileSync("wrangler", ["secret", "bulk"], {
	input: JSON.stringify({
		OIDC_ISSUER: `https://${ID_DOMAIN}`,
		OIDC_CLIENT_ID: clientId,
		OIDC_CLIENT_SECRET: clientSecret,
	}),
	stdio: ["pipe", "inherit", "inherit"],
});
console.log(
	`${APP_NAME} is registered with https://${ID_DOMAIN} as client ${clientId}; its settings are this Worker's secrets.`,
);
