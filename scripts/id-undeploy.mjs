// mise run id:undeploy: Gateweave ID off Cloudflare, every piece of it, so id:deploy can be proved from nothing.
//
//   1. The Cloudflare login (scripts/cloudflare-login.mjs).
//   2. Its Worker taken off its logouts queue as the consumer (Cloudflare won't delete a queue's consumer).
//   3. Its Worker (with its Custom Domain, its rate limiter's Durable Object, its secrets, OIDC_PAIRWISE_SECRET
//      among them, and its cron).
//   4. Its logouts queue.
//   5. Its D1 database (every account, workspace and registered app).
//
// Each is simply deleted; one already gone is reported and skipped. Everything in ID is gone for good, and every app
// that signs in through it gets new ids for everyone when ID is deployed again.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { remove } from "./cloudflare.mjs";
import { fetchId, ID_ROOT, ID_WRANGLER } from "./id-release.mjs";

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
console.log(`\nGateweave ID is off Cloudflare.\n`);
