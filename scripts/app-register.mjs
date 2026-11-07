// mise run app:register: this app registers itself with Gateweave ID as a first-party client, and its client id and
// secret go straight into this app's Worker secrets (with OIDC_ISSUER), never printed. Already registered (the app's
// Worker has OIDC_CLIENT_ID), it does nothing, so the client secret isn't replaced on every run. Needs ID deployed
// (id:deploy) and this app's Worker deployed (app:deploy).
//
// Secrets follow the README's Secrets section.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { APP_DOMAIN, APP_ID, APP_NAME } from "./app-config.mjs";
import { fetchId, ID_DOMAIN, ID_WEB, idWrangler } from "./id-release.mjs";

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
// The row ID's own `apps:add` writes, built with ID's own helpers (src/server/auth/app-row.ts), but run as one SQL
// command: `wrangler d1 execute --file`, which apps:add uses, uploads the file to R2 first, and some networks block
// that (a Claude cloud session does). --command goes straight to D1's API.
const { appRow, insertStatement, appAddedStatement } = await import(
	pathToFileURL(resolve(ID_WEB, "src/server/auth/app-row.ts")).href
);
const { row, clientId, clientSecret } = appRow({
	app: APP_ID,
	name: APP_NAME,
	redirectUris: [`https://${APP_DOMAIN}/api/auth/callback/oidc`],
	backchannelLogoutUri: `https://${APP_DOMAIN}/api/auth/backchannel-logout/oidc`,
	requirePkce: true,
});
idWrangler(
	[
		"d1",
		"execute",
		"DB",
		"--remote",
		"--command",
		`${insertStatement(row)} ${appAddedStatement(APP_ID)}`,
	],
	{
		stdio: ["ignore", "ignore", "inherit"],
	},
);
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
