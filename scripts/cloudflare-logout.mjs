// Ends this repo's Cloudflare login (`wrangler logout`): Wrangler revokes the OAuth token and deletes it here.
// Not logged in: it says so. The counterpart of scripts/cloudflare-login.mjs.
// Run: mise run cloudflare:logout
import { spawnSync } from "node:child_process";

const loggedIn = () =>
	!/not authenticated/i.test(spawnSync("wrangler", ["whoami"], { encoding: "utf8" }).stdout ?? "");

if (!loggedIn()) {
	console.log("Not logged in to Cloudflare; nothing to do.");
	process.exit(0);
}
spawnSync("wrangler", ["logout"], { stdio: "inherit" });
if (loggedIn()) {
	console.error(
		"Still logged in to Cloudflare: the logout didn't take. Run mise run cloudflare:logout again.",
	);
	process.exit(1);
}
console.log("Logged out of Cloudflare. mise run cloudflare:login to log in again.");
