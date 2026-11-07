// mise run id:deploy: Gateweave ID onto Cloudflare, on its own Worker at id.ubuntusoftware.net. ID only; the app
// registers itself with ID in app:register.
//
//   1. The Cloudflare login (scripts/cloudflare-login.mjs: already logged in, it says as whom).
//   2. ID's pinned release, installed with aube (scripts/id-release.mjs).
//   3. ID's own deploy script, as the "Deploy to Cloudflare" button would: it builds, creates ID's D1 if missing,
//      applies its migrations and, on the first deploy, sets its BETTER_AUTH_SECRET. ID answers on its Custom
//      Domain, with that address pinned as its issuer.
//   4. ID's OIDC_PAIRWISE_SECRET, which turns its sign-in provider on: made once, Cloudflare keeps it.
//
// Secrets follow the README's Secrets section.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchId, ID_DOMAIN, ID_ROOT, ID_WEB, idWrangler } from "./id-release.mjs";

execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });
fetchId();

// ID's wrangler.jsonc, as fetched, has no route and no pinned address: give it its Custom Domain, and pin
// BETTER_AUTH_URL so its issuer is that address. The fetched copy is git-ignored.
const config = join(ID_ROOT, "wrangler.jsonc");
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
execFileSync("node", ["scripts/deploy.mjs"], { cwd: ID_WEB, stdio: "inherit" });

// ID's OpenID Connect provider stays off until OIDC_PAIRWISE_SECRET is set (ID's docs/self-hosting.md, "Turning on
// the provider"). Changing it would give everybody new ids in every app, so it is made once and never set again.
const secrets = JSON.parse(
	idWrangler(["secret", "list", "--format", "json"], { encoding: "utf8" }),
);
if (secrets.some(({ name }) => name === "OIDC_PAIRWISE_SECRET")) {
	console.log("ID's OIDC_PAIRWISE_SECRET is already set; left as it is.");
} else {
	idWrangler(["secret", "put", "OIDC_PAIRWISE_SECRET"], {
		input: randomBytes(48).toString("base64"),
		stdio: ["pipe", "ignore", "inherit"],
	});
	console.log("ID's OIDC_PAIRWISE_SECRET is set (made here once; Cloudflare keeps it).");
}
console.log(
	`\nGateweave ID is on https://${ID_DOMAIN}. Sign up there now: the first account owns the server.\n`,
);
