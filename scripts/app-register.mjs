// mise run app:register <env>: courts registers itself with that environment's Gateweave ID as a first-party client,
// and its client id and secret (with OIDC_ISSUER) go straight to courts, never printed. Staging courts signs in through
// staging ID only, production through production ID only, development (mise run all:dev, on this machine) through the
// local ID only. On Cloudflare, mise runs id:deploy and app:deploy for the same environment first (its `depends`);
// all:dev registers between setting the pair up and starting them.
//
// The same steps everywhere; only where they act changes (scripts/environments.mjs, `local`):
//   staging, production   ID's D1 on Cloudflare; courts' settings in its Worker's secrets
//   development           ID's local D1 (the one ID's own `dev` uses); courts' settings in its .dev.vars
//
// Registered means both halves are there and agree with where the pair is now: ID has this app's client for this app's
// callback address (its D1), and this app has the settings (OIDC_CLIENT_ID, and in development OIDC_ISSUER for this
// ID's address). Then it is left as it is, so the client secret isn't replaced on every run. Either half missing or
// pointing elsewhere, as after ID is rebuilt on its own or development comes up on new addresses, it registers again
// and replaces the app's settings. On staging and production the addresses never change.
//
// Then it proves sign-in through ID: this app's sign-in starts, and ID's authorize page, for the client id the app
// sent, takes the browser to ID's own login page. A client ID doesn't know would not.
//
// Secrets follow the README's Secrets section.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ID, APP_NAME, appOrigin } from "./app-config.mjs";
import { waitUntilUp } from "./cloudflare.mjs";
import { chooseEnvironment, local } from "./environments.mjs";
import { fetchId, ID_WEB, idD1, idOrigin, idWrangler } from "./id-release.mjs";

const DEV_VARS = ".dev.vars";

/** Whether courts in `env` has its settings, for this ID: its Worker's secrets, or .dev.vars. */
function hasSettings(env) {
	if (local(env)) {
		const vars = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, "utf8") : "";
		return (
			/^OIDC_CLIENT_ID=/m.test(vars) && vars.split("\n").includes(`OIDC_ISSUER=${idOrigin(env)}`)
		);
	}
	const secrets = JSON.parse(
		execFileSync("wrangler", ["secret", "list", "--format", "json"], { encoding: "utf8" }),
	);
	return secrets.some(({ name }) => name === "OIDC_CLIENT_ID");
}

/** Puts courts' settings where `env` keeps them: its Worker's secrets, or .dev.vars (the other lines kept). */
function putSettings(env, settings) {
	if (!local(env)) {
		execFileSync("wrangler", ["secret", "bulk"], {
			input: JSON.stringify(settings),
			stdio: ["pipe", "inherit", "inherit"],
		});
		return;
	}
	setDevVars(DEV_VARS, settings);
}

/** Sets these lines in a .dev.vars file, keeping every other line (development's secrets, git-ignored). */
export function setDevVars(file, settings) {
	const kept = (existsSync(file) ? readFileSync(file, "utf8") : "")
		.split("\n")
		.filter((line) => line && !Object.keys(settings).some((name) => line.startsWith(`${name}=`)));
	const added = Object.entries(settings).map(([name, value]) => `${name}=${value}`);
	writeFileSync(file, `${[...kept, ...added].join("\n")}\n`);
}

/** Registers courts with `env`'s Gateweave ID, unless both halves are there already. */
export async function register(env) {
	const APP = appOrigin(env);
	const ID = idOrigin(env);
	const inId = JSON.parse(
		idWrangler(
			[
				"d1",
				"execute",
				"DB",
				...idD1(env),
				"--json",
				"--command",
				`SELECT COUNT(*) AS clients FROM oauth_client WHERE json_extract(metadata, '$.app') = '${APP_ID}' AND reference_id IS NULL AND EXISTS (SELECT 1 FROM json_each(redirect_uris) WHERE value = '${APP}/api/auth/callback/oidc')`,
			],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
		),
	)[0].results[0].clients;
	if (inId > 0 && hasSettings(env)) {
		console.log(`${APP_NAME} is already registered with ${ID}; left as it is.`);
		return;
	}
	// A registration whose secret never reached this app is useless: clear any before making the new one.
	idWrangler(
		[
			"d1",
			"execute",
			"DB",
			...idD1(env),
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
		redirectUris: [`${APP}/api/auth/callback/oidc`],
		backchannelLogoutUri: `${APP}/api/auth/backchannel-logout/oidc`,
		requirePkce: true,
	});
	idWrangler(
		[
			"d1",
			"execute",
			"DB",
			...idD1(env),
			"--command",
			`${insertStatement(row)} ${appAddedStatement(APP_ID)}`,
		],
		{ stdio: ["ignore", "ignore", "inherit"] },
	);
	putSettings(env, { OIDC_ISSUER: ID, OIDC_CLIENT_ID: clientId, OIDC_CLIENT_SECRET: clientSecret });
	console.log(`${APP_NAME} registered with ${ID}.`);
}

/** Proves courts in `env` signs in through its own Gateweave ID: courts' sign-in reaches that ID's login page. */
export async function prove(env) {
	const APP = appOrigin(env);
	const ID = idOrigin(env);
	let authorize = "";
	// Courts first, then its sign-in: asked every second while courts starts, sign-in would trip its own limit
	// (3 every 10 seconds, src/server/auth/config.ts).
	await waitUntilUp("This app", `${APP}/api/auth/ok`);
	await waitUntilUp(
		"This app's sign-in through Gateweave ID",
		`${APP}/api/auth/sign-in/social`,
		(response, body) => {
			authorize = response.ok ? (JSON.parse(body).url ?? "") : "";
			return authorize.startsWith(`${ID}/`);
		},
		{
			method: "POST",
			headers: { "content-type": "application/json", origin: APP },
			body: JSON.stringify({ provider: "oidc", callbackURL: "/" }),
		},
	);
	await waitUntilUp(
		"Gateweave ID's login page for this app",
		authorize,
		// To a browser ID answers with a redirect; to a script like this, with the same address as JSON
		// ({"redirect":true,"url":…}). Either one must be ID's own login page.
		(response, body) => {
			let where = response.headers.get("location");
			if (!where) {
				try {
					where = JSON.parse(body).url;
				} catch {}
			}
			const to = new URL(where ?? "", authorize);
			return to.origin === ID && to.pathname === "/login";
		},
		{ redirect: "manual" },
	);
	console.log(`${APP_NAME} signs in through ${ID}.`);
}

// Run as the task: one environment, registered and proved.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const env = chooseEnvironment({ development: true });
	if (!local(env)) execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });
	fetchId();
	await register(env);
	await prove(env);
}
