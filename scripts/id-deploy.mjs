// mise run id:deploy <env>: that environment's Gateweave ID onto Cloudflare as id-<env>, at its Custom Domain in
// id.jsonc, set up as a server open to the internet (ID's docs/self-hosting.md). ID only; the app registers itself
// with ID in app:register.
//
//   1. The environment (CLOUDFLARE_ENV for every command after) and the Cloudflare login.
//   2. ID's pinned release, installed with aube, with our environments written into its wrangler.jsonc
//      (scripts/id-release.mjs).
//   3. Email: Cloudflare Email Sending on for this ID's own name, so ubuntusoftware.net's own mail records are never
//      touched. ID then sends sign-up codes, password resets and invitations from EMAIL_FROM.
//   4. Turnstile: ID's own, with a widget for this ID's address, named after its Worker (found by name, or made). Its
//      site key goes into this environment's vars; its secret key, made by Cloudflare with the widget, straight into
//      ID's Worker secrets.
//   5. Its D1, if it isn't there yet, made in LOCATION (Asia-Pacific, issue #5): ID's deploy script uses a D1 that is
//      already there, and left to `wrangler deploy` it is made next to whoever deploys.
//   6. ID's own deploy script, as Gateweave deploy their own environments, with CLOUDFLARE_ENV: it builds, applies
//      its migrations and, on the first deploy, sets its BETTER_AUTH_SECRET.
//   7. ID's secrets: OIDC_PAIRWISE_SECRET (turns its sign-in provider on) and TURNSTILE_SECRET_KEY, each set once.
//   8. Waits until ID's discovery document answers with its own address as the issuer (provider on, domain live).
//   9. id:claim (scripts/id-claim.mjs): a new server waits for its first account, which owns it; it must be yours.
//  10. Sign-up open, so anyone can make an account: after the claim, so the server is never open without an owner.
//
// Secrets follow the README's Secrets section.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { waitUntilUp } from "./cloudflare.mjs";
import { chooseEnvironment, LOCATION } from "./environments.mjs";
import { fetchId, ID_ROOT, ID_WEB, idConfig, idWrangler, setIdVar } from "./id-release.mjs";

const env = chooseEnvironment();
execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });
fetchId();
const { worker, database, domain: ID_DOMAIN } = idConfig(env);
/** ID's Turnstile widget, named after its Worker, so id:deploy finds it again and id:undeploy deletes it. */
const ID_TURNSTILE_WIDGET = worker;

const quiet = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
const secretNames = () => {
	const listed = spawnSync(
		"node",
		["apps/web/node_modules/wrangler/bin/wrangler.js", "secret", "list", "--format", "json"],
		{ cwd: ID_ROOT, encoding: "utf8" },
	);
	// No Worker yet (the first deploy): no secrets.
	return listed.status === 0 ? JSON.parse(listed.stdout).map(({ name }) => name) : [];
};
const before = secretNames();

// 3. Email Sending for ID's own name. `enable` on a name that already has it is refused, so it is asked first.
if (idWrangler(["email", "sending", "list"], quiet).includes(ID_DOMAIN)) {
	console.log(`Email Sending is already on for ${ID_DOMAIN}; left as it is.`);
} else {
	idWrangler(["email", "sending", "enable", ID_DOMAIN], { stdio: "inherit" });
}

// 4. The Turnstile widget: found by name, or made. Its secret key can always be read back (`widget get`), so it is
// read only when ID's Worker doesn't have it yet, and goes straight in after the deploy (step 7).
const widgets = JSON.parse(idWrangler(["turnstile", "widget", "list", "--json"], quiet));
let widget = widgets.find(({ name }) => name === ID_TURNSTILE_WIDGET);
if (widget) {
	console.log(`ID's Turnstile widget is already there (${widget.sitekey}); left as it is.`);
} else {
	widget = JSON.parse(
		idWrangler(
			[
				"turnstile",
				"widget",
				"create",
				ID_TURNSTILE_WIDGET,
				"--domain",
				ID_DOMAIN,
				"--mode",
				"managed",
				"--json",
			],
			quiet,
		),
	);
	console.log(`ID's Turnstile widget is made (${widget.sitekey}).`);
}
const turnstileSecret = before.includes("TURNSTILE_SECRET_KEY")
	? null
	: (widget.secret ??
		JSON.parse(idWrangler(["turnstile", "widget", "get", widget.sitekey, "--json"], quiet)).secret);

// The site key into this environment's vars (ID's sign-up page shows the widget with it).
setIdVar(env, "TURNSTILE_SITE_KEY", widget.sitekey);

// 5. ID's D1, made in LOCATION if it isn't there yet.
const databases = JSON.parse(idWrangler(["d1", "list", "--json"], quiet));
if (databases.some(({ name }) => name === database)) {
	console.log(`The D1 database ${database} is already there; left as it is.`);
} else {
	idWrangler(["d1", "create", database, "--location", LOCATION, "--update-config=false"], {
		stdio: "inherit",
	});
}

// 6. ID's own deploy script, with this environment's CLOUDFLARE_ENV (inherited).
execFileSync("node", ["scripts/deploy.mjs"], { cwd: ID_WEB, stdio: "inherit" });

// 7. ID's secrets, each set once. OIDC_PAIRWISE_SECRET: ID's OpenID Connect provider stays off until it is set (ID's
// docs/self-hosting.md, "Turning on the provider"), and changing it would give everybody new ids in every app.
const after = secretNames();
if (after.includes("OIDC_PAIRWISE_SECRET")) {
	console.log("ID's OIDC_PAIRWISE_SECRET is already set; left as it is.");
} else {
	idWrangler(["secret", "put", "OIDC_PAIRWISE_SECRET"], {
		input: randomBytes(48).toString("base64"),
		stdio: ["pipe", "ignore", "inherit"],
	});
	console.log("ID's OIDC_PAIRWISE_SECRET is set (made here once; Cloudflare keeps it).");
}
if (turnstileSecret) {
	idWrangler(["secret", "put", "TURNSTILE_SECRET_KEY"], {
		input: turnstileSecret,
		stdio: ["pipe", "ignore", "inherit"],
	});
	console.log(
		"ID's TURNSTILE_SECRET_KEY is set (made by Cloudflare with the widget; Cloudflare keeps it).",
	);
} else {
	console.log("ID's TURNSTILE_SECRET_KEY is already set; left as it is.");
}

// 8. Proof the provider is on and the domain answers.
await waitUntilUp(
	"Gateweave ID's sign-in provider",
	`https://${ID_DOMAIN}/.well-known/openid-configuration`,
	(response, body) => response.ok && JSON.parse(body).issuer === `https://${ID_DOMAIN}`,
);

// 9. The owner.
execFileSync("node", ["scripts/id-claim.mjs", env], { stdio: "inherit" });

// 10. Sign-up open. ID's own switch for it is the owner's account page, behind the owner's sign-in, so it is set in
// ID's D1 here, as that switch does (ID's src/server/auth/deployment.ts, setDeploymentSignUp).
idWrangler(
	[
		"d1",
		"execute",
		"DB",
		"--remote",
		"--command",
		"UPDATE deployment SET sign_up = 'open', updated_at = cast(unixepoch('subsecond') * 1000 as integer) WHERE id = 1 AND sign_up <> 'open'",
	],
	{ stdio: ["ignore", "ignore", "inherit"] },
);
console.log("ID's sign-up is open: anyone can make an account.");
console.log(`\nGateweave ID is on https://${ID_DOMAIN}.\n`);
