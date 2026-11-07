// mise run id:deploy: Gateweave ID onto Cloudflare, on its own Worker at id.ubuntusoftware.net, set up as a server open
// to the internet (ID's docs/self-hosting.md). ID only; the app registers itself with ID in app:register.
//
//   1. The Cloudflare login (scripts/cloudflare-login.mjs: already logged in, it says as whom).
//   2. ID's pinned release, installed with aube (scripts/id-release.mjs).
//   3. Email: Cloudflare Email Sending on for ID's own name, id.ubuntusoftware.net, so ubuntusoftware.net's own mail
//      records are never touched. ID then sends sign-up codes, password resets and invitations from EMAIL_FROM.
//   4. Turnstile: ID's own, switched on with a widget for ID's address (found by name, or made). Its site key is a
//      setting; its secret key, made by Cloudflare with the widget, goes straight into ID's Worker secrets.
//   5. ID's wrangler.jsonc, as fetched, given its Custom Domain and its settings: BETTER_AUTH_URL (its issuer),
//      EMAIL_FROM, TURNSTILE_SITE_KEY and CHECK_BREACHED_PASSWORDS. Rewritten from the fetched file on every run.
//   6. ID's own deploy script, as the "Deploy to Cloudflare" button would: it builds, creates ID's D1 if missing,
//      applies its migrations and, on the first deploy, sets its BETTER_AUTH_SECRET.
//   7. ID's secrets: OIDC_PAIRWISE_SECRET (turns its sign-in provider on) and TURNSTILE_SECRET_KEY, each set once.
//   8. Waits until ID's discovery document answers with its own address as the issuer (provider on, domain live).
//   9. id:claim (scripts/id-claim.mjs): a new server waits for its first account, which owns it; it must be yours.
//  10. Sign-up open, so anyone can make an account: after the claim, so the server is never open without an owner.
//
// Secrets follow the README's Secrets section.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { waitUntilUp } from "./cloudflare.mjs";
import {
	fetchId,
	ID_DOMAIN,
	ID_ROOT,
	ID_TURNSTILE_WIDGET,
	ID_WEB,
	idWrangler,
} from "./id-release.mjs";

/** Who ID's email comes from: a sender on ID's own Email Sending name. */
const EMAIL_FROM = `Gateweave ID <noreply@${ID_DOMAIN}>`;

execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });
fetchId();

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

// 5. ID's wrangler.jsonc, from the fetched file each time (git restores it), with its Custom Domain and settings.
// The fetched copy is git-ignored here.
execFileSync("git", ["checkout", "--", "wrangler.jsonc"], { cwd: ID_ROOT });
const config = join(ID_ROOT, "wrangler.jsonc");
const vars = {
	BETTER_AUTH_URL: `https://${ID_DOMAIN}`,
	EMAIL_FROM,
	TURNSTILE_SITE_KEY: widget.sitekey,
	CHECK_BREACHED_PASSWORDS: "1",
};
const text = readFileSync(config, "utf8");
const patched = text.replace(
	/("name":\s*"gateweave-id",)/,
	`$1\n\t"routes": [{ "pattern": "${ID_DOMAIN}", "custom_domain": true }],\n\t"vars": ${JSON.stringify(vars)},`,
);
if (patched === text)
	throw new Error(`ID's wrangler.jsonc has no "name": "gateweave-id" to put its settings after`);
writeFileSync(config, patched);

// 6. ID's own deploy script.
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
execFileSync("node", ["scripts/id-claim.mjs"], { stdio: "inherit" });

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
