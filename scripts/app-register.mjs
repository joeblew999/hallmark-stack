// mise run app:register: this app registers itself with Gateweave ID as a first-party client, and its client id and
// secret go straight into this app's Worker secrets (with OIDC_ISSUER), never printed. mise runs id:deploy and
// app:deploy first (its `depends`).
//
// Registered means both halves are there: ID has this app's client (its D1) and this app has the settings (its
// Worker's OIDC_CLIENT_ID). Then it is left as it is, so the client secret isn't replaced on every run. Either half
// missing, as after ID is rebuilt on its own, it registers again and replaces the app's settings.
//
// Then it proves sign-in through ID: this app's sign-in starts, and ID's authorize page, for the client id the app
// sent, takes the browser to ID's own login page. A client ID doesn't know would not.
//
// Secrets follow the README's Secrets section.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { APP_DOMAIN, APP_ID, APP_NAME } from "./app-config.mjs";
import { waitUntilUp } from "./cloudflare.mjs";
import { fetchId, ID_DOMAIN, ID_WEB, idWrangler } from "./id-release.mjs";

execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });

fetchId();
const appSecrets = JSON.parse(
	execFileSync("wrangler", ["secret", "list", "--format", "json"], { encoding: "utf8" }),
);
const inId = JSON.parse(
	idWrangler(
		[
			"d1",
			"execute",
			"DB",
			"--remote",
			"--json",
			"--command",
			`SELECT COUNT(*) AS clients FROM oauth_client WHERE json_extract(metadata, '$.app') = '${APP_ID}' AND reference_id IS NULL`,
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
	),
)[0].results[0].clients;
const registered = inId > 0 && appSecrets.some(({ name }) => name === "OIDC_CLIENT_ID");
if (registered) {
	console.log(`${APP_NAME} is already registered with https://${ID_DOMAIN}; left as it is.`);
} else {
	await register();
}

async function register() {
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
}

let authorize = "";
await waitUntilUp(
	"This app's sign-in through Gateweave ID",
	`https://${APP_DOMAIN}/api/auth/sign-in/social`,
	(response, body) => {
		authorize = response.ok ? (JSON.parse(body).url ?? "") : "";
		return authorize.startsWith(`https://${ID_DOMAIN}/`);
	},
	{
		method: "POST",
		headers: { "content-type": "application/json", origin: `https://${APP_DOMAIN}` },
		body: JSON.stringify({ provider: "oidc", callbackURL: "/" }),
	},
);
await waitUntilUp(
	"Gateweave ID's login page for this app",
	authorize,
	(response) => {
		const to = new URL(response.headers.get("location") ?? "", authorize);
		return to.hostname === ID_DOMAIN && to.pathname === "/login";
	},
	{ redirect: "manual" },
);
console.log(`${APP_NAME} signs in through https://${ID_DOMAIN}.`);
