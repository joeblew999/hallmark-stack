// mise run id:claim <env>: who owns that environment's Gateweave ID (id-<env>). Run by id:deploy, and on its own any
// time. Each environment's ID is a server of its own, with an owner of its own.
//
// A new ID server's first account owns it (a trigger in ID's migrations/0014_deployment_hold.sql makes that account
// deployment.owner_id). Like cloudflare:login, the claim is done in the browser: ID's Create account page, where a
// password manager makes and keeps the password, and ID emails a code to prove the address (id:deploy turns ID's
// email on). This task only reads the owner from ID's D1:
//
//   - No account yet: prints ID's address and waits, up to 10 minutes, for you to create an account there.
//   - Owned by the email you are logged in to Cloudflare with: says so.
//   - Owned by anyone else: stops. Someone got there first; id:undeploy then id:deploy starts again.
//
// Development (mise run all:dev, which runs this when its ID has no owner) is claimed the same way, at the local ID's
// address: you use Create account there. The local ID sends no email; it saves each one as a file
// (vendor/gateweave-id/apps/web/.wrangler/tmp/email, ID's README), so this prints each code it finds there, for you to
// type in. Any address will do: there is no Cloudflare login in development to match it to.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chooseEnvironment, local } from "./environments.mjs";
import { fetchId, ID_WEB, idD1, idOrigin, idWrangler } from "./id-release.mjs";

/** Where the local ID saves the emails it would send (ID's README, "Running it locally"). */
const OUTBOX = join(ID_WEB, ".wrangler/tmp/email");
const printed = new Set();
/** Prints each sign-up code the local ID has saved since `since`, once. */
function printCodes(since) {
	let files = [];
	try {
		files = readdirSync(OUTBOX, { recursive: true, encoding: "utf8" });
	} catch {
		return;
	}
	for (const file of files.filter((f) => f.includes("email-text")).map((f) => join(OUTBOX, f))) {
		if (printed.has(file) || !statSync(file).isFile() || statSync(file).mtimeMs < since) continue;
		const code = /\b\d{6}\b/.exec(readFileSync(file, "utf8"))?.[0];
		if (!code) continue;
		printed.add(file);
		console.log(`Gateweave ID's code for you: ${code}`);
	}
}

const env = chooseEnvironment({ development: true });
if (!local(env)) execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });
fetchId();
const ID = idOrigin(env);

const you = local(env)
	? undefined
	: JSON.parse(execFileSync("wrangler", ["whoami", "--json"], { encoding: "utf8" })).email;

/** How many accounts ID has, and its owner's email. */
function owner() {
	const out = idWrangler(
		[
			"d1",
			"execute",
			"DB",
			...idD1(env),
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
		local(env)
			? `\nThe local Gateweave ID has no owner yet. Open ${ID} now and use Create account, with your own email and password: the first account owns it.\nThe code ID would email you is printed here when you ask for it. Waiting (up to 10 minutes)…`
			: `\nGateweave ID has no owner yet. Open ${ID} now and use Create account, as ${you}: the first account owns it.\nID emails a code to ${you}; type it in there. Waiting (up to 10 minutes)…`,
	);
	const since = Date.now() - 1_000;
	const until = Date.now() + 10 * 60_000;
	while (found.users === 0) {
		if (Date.now() > until)
			throw new Error("Nobody created an account at Gateweave ID within 10 minutes.");
		if (local(env)) {
			for (let i = 0; i < 5; i++) {
				printCodes(since);
				await new Promise((done) => setTimeout(done, 1_000));
			}
		} else await new Promise((done) => setTimeout(done, 5_000));
		found = owner();
	}
}
if (you && found.email?.toLowerCase() !== you.toLowerCase()) {
	throw new Error(
		`Gateweave ID is owned by ${found.email ?? "nobody"}, not ${you}. Start it again: mise run id:undeploy ${env}, then mise run id:deploy ${env}.`,
	);
}
console.log(`${ID} is claimed by ${you ?? found.email}.`);
