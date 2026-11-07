// mise run id:claim: who owns Gateweave ID. Run by id:deploy, and on its own any time.
//
// A new ID server's first account owns it (a trigger in ID's migrations/0014_deployment_hold.sql makes that account
// deployment.owner_id). Like cloudflare:login, the claim is done in the browser: ID's Create account page, where a
// password manager makes and keeps the password, and ID emails a code to prove the address (id:deploy turns ID's
// email on). This task only reads the owner from ID's D1:
//
//   - No account yet: prints ID's address and waits, up to 10 minutes, for you to create an account there.
//   - Owned by the email you are logged in to Cloudflare with: says so.
//   - Owned by anyone else: stops. Someone got there first; id:undeploy then id:deploy starts again.
import { execFileSync } from "node:child_process";
import { fetchId, ID_DOMAIN, idWrangler } from "./id-release.mjs";

execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });
fetchId();

const you = JSON.parse(execFileSync("wrangler", ["whoami", "--json"], { encoding: "utf8" })).email;

/** How many accounts ID has, and its owner's email. */
function owner() {
	const out = idWrangler(
		[
			"d1",
			"execute",
			"DB",
			"--remote",
			"--json",
			"--command",
			"SELECT (SELECT COUNT(*) FROM user) AS users, (SELECT user.email FROM deployment JOIN user ON user.id = deployment.owner_id WHERE deployment.id = 1) AS email",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
	);
	return JSON.parse(out)[0].results[0];
}

let found = owner();
if (found.users === 0) {
	console.log(
		`\nGateweave ID has no owner yet. Open https://${ID_DOMAIN} now and use Create account, as ${you}: the first account owns it.\nID emails a code to ${you}; type it in there. Waiting (up to 10 minutes)…`,
	);
	const until = Date.now() + 10 * 60_000;
	while (found.users === 0) {
		if (Date.now() > until)
			throw new Error("Nobody created an account at Gateweave ID within 10 minutes.");
		await new Promise((done) => setTimeout(done, 5_000));
		found = owner();
	}
}
if (found.email?.toLowerCase() !== you.toLowerCase()) {
	throw new Error(
		`Gateweave ID is owned by ${found.email ?? "nobody"}, not ${you}. Start it again: mise run id:undeploy, then mise run id:deploy.`,
	);
}
console.log(`Gateweave ID is claimed by ${you}.`);
