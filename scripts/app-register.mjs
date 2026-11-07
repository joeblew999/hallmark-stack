// mise run app:register: this app registers itself with Gateweave ID as a first-party client, and its client id and
// secret go straight into this app's Worker secrets (with OIDC_ISSUER), never printed. Already registered (the app's
// Worker has OIDC_CLIENT_ID), it does nothing, so the client secret isn't replaced on every run. Needs ID deployed
// (id:deploy) and this app's Worker deployed (app:deploy).
//
// Secrets follow the README's Secrets section.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fetchId, ID_DOMAIN, ID_WEB, idWrangler } from "./id-release.mjs";

/** This app's id at ID, and its name on ID's pages. */
const APP_ID = "courts";
const APP_NAME = "Eastfield Courts";
/** Where this app answers: its route in its own wrangler.jsonc. */
const APP_DOMAIN = /"pattern":\s*"([^"]+)"/.exec(readFileSync("wrangler.jsonc", "utf8"))?.[1];
if (!APP_DOMAIN) throw new Error("wrangler.jsonc has no route pattern");

execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });

const appSecrets = JSON.parse(
	execFileSync("wrangler", ["secret", "list", "--format", "json"], { encoding: "utf8" }),
);
if (appSecrets.some(({ name }) => name === "OIDC_CLIENT_ID")) {
	console.log(`${APP_NAME} is already registered with https://${ID_DOMAIN}; left as it is.`);
	process.exit(0);
}

fetchId();
// A registration whose secret never reached this app is useless: clear any before making the new one.
idWrangler(
	[
		"d1",
		"execute",
		"DB",
		"--remote",
		"--command",
		`DELETE FROM oauth_client WHERE json_extract(metadata, '$.app') = '${APP_ID}' AND reference_id IS NULL`,
	],
	{ stdio: ["ignore", "ignore", "inherit"] },
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
	{ cwd: ID_WEB, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
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
	`${APP_NAME} is registered with https://${ID_DOMAIN}; its settings are this Worker's secrets.`,
);
