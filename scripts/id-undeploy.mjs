// mise run id:undeploy: Gateweave ID off Cloudflare, every piece of it, so id:deploy can be proved from nothing.
//
//   1. The Cloudflare login (scripts/cloudflare-login.mjs).
//   2. Its Worker taken off its logouts queue as the consumer (Cloudflare won't delete a queue's consumer).
//   3. Its Worker (with its Custom Domain, its rate limiter's Durable Object, its secrets, OIDC_PAIRWISE_SECRET
//      among them, and its cron).
//   4. Its logouts queue.
//   5. Its D1 database (every account, workspace and registered app).
//   6. Its Turnstile widget.
//   7. Email Sending for its own name, id.ubuntusoftware.net (ubuntusoftware.net's own mail is not touched).
//
// Each is simply deleted; one already gone is reported and skipped. Everything in ID is gone for good, and every app
// that signs in through it gets new ids for everyone when ID is deployed again.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { remove } from "./cloudflare.mjs";
import {
	fetchId,
	ID_DOMAIN,
	ID_ROOT,
	ID_TURNSTILE_WIDGET,
	ID_WRANGLER,
	idWrangler,
} from "./id-release.mjs";

execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });

fetchId();
// The names, from ID's own wrangler.jsonc (its top level, which is what id:deploy deploys).
const config = readFileSync(join(ID_ROOT, "wrangler.jsonc"), "utf8");
const worker = /"name":\s*"([^"]+)"/.exec(config)?.[1];
const database = /"database_name":\s*"([^"]+)"/.exec(config)?.[1];
const queue = /"queue":\s*"([^"]+)"/.exec(config)?.[1];
if (!worker || !database || !queue)
	throw new Error("ID's wrangler.jsonc has no Worker, D1 or queue name");

const id = { wrangler: ID_WRANGLER, cwd: ID_ROOT };
remove(
	`the Worker ${worker} as the queue ${queue}'s consumer`,
	["queues", "consumer", "remove", queue, worker],
	id,
);
remove(`the Worker ${worker}`, ["delete", worker, "--force"], id);
remove(`the queue ${queue}`, ["queues", "delete", queue], id);
remove(`the D1 database ${database}`, ["d1", "delete", database, "--skip-confirmation"], id);

// Neither says "not found" when the thing is already gone, so each is looked for first.
const quiet = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
const widget = JSON.parse(idWrangler(["turnstile", "widget", "list", "--json"], quiet)).find(
	({ name }) => name === ID_TURNSTILE_WIDGET,
);
if (widget) {
	remove(
		`the Turnstile widget ${ID_TURNSTILE_WIDGET}`,
		["turnstile", "widget", "delete", widget.sitekey, "--skip-confirmation"],
		id,
	);
} else {
	console.log(`The Turnstile widget ${ID_TURNSTILE_WIDGET} was already gone.`);
}
// --force: without it, `disable` asks, takes no answer as no, says "Not disabling." and still exits 0. Disabling it
// is what removes the six DNS records Email Sending made under ID's name, so it is checked after.
if (idWrangler(["email", "sending", "list"], quiet).includes(ID_DOMAIN)) {
	remove(
		`Email Sending for ${ID_DOMAIN}`,
		["email", "sending", "disable", ID_DOMAIN, "--force"],
		id,
	);
	if (idWrangler(["email", "sending", "list"], quiet).includes(ID_DOMAIN)) {
		throw new Error(`Email Sending for ${ID_DOMAIN} is still on after disabling it.`);
	}
	// Seen 2026-11-07: disabling removes five of the six records (the ones Cloudflare locks to email) but not the
	// DMARC record it made as an ordinary one, and Wrangler's login has no scope that can edit DNS.
	console.log(
		`Left by Cloudflare: TXT _dmarc.${ID_DOMAIN}. Wrangler can't edit DNS; delete it in the dashboard (DNS, Records) or through the Cloudflare API.`,
	);
} else {
	console.log(`Email Sending for ${ID_DOMAIN} was already gone.`);
}
console.log(`\nGateweave ID is off Cloudflare.\n`);
