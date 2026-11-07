// mise run app:undeploy <env>: courts-<env> off Cloudflare, every piece of it, so app:deploy can be proved from nothing.
// Every name comes from that environment's config and every command runs with its CLOUDFLARE_ENV, so undeploying
// staging can't touch production.
//
//   1. The Cloudflare login (scripts/cloudflare-login.mjs).
//   2. Its registration with Gateweave ID (the oauth_client row app:register made).
//   3. Its Worker (with its Custom Domain, its Durable Object's bookings, its secrets and its cron).
//   4. Its D1 database (its accounts and sessions).
//
// Each is simply deleted; one already gone is reported and skipped. Its accounts and bookings are gone for good.
import { execFileSync } from "node:child_process";
import { APP_ID, appConfig } from "./app-config.mjs";
import { APP_WRANGLER, remove } from "./cloudflare.mjs";
import { chooseEnvironment } from "./environments.mjs";
import { fetchId, ID_ROOT, ID_WRANGLER } from "./id-release.mjs";

const env = chooseEnvironment();
const { worker: APP_WORKER, database: APP_DATABASE } = appConfig(env);
execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });

fetchId();
remove(
	`${APP_WORKER}'s registration with Gateweave ID`,
	[
		"d1",
		"execute",
		"DB",
		"--remote",
		"--command",
		`DELETE FROM oauth_client WHERE json_extract(metadata, '$.app') = '${APP_ID}' AND reference_id IS NULL`,
	],
	{ wrangler: ID_WRANGLER, cwd: ID_ROOT },
);
remove(`the Worker ${APP_WORKER}`, ["delete", APP_WORKER, "--force"], { wrangler: APP_WRANGLER });
remove(`the D1 database ${APP_DATABASE}`, ["d1", "delete", APP_DATABASE, "--skip-confirmation"], {
	wrangler: APP_WRANGLER,
});
console.log(`\n${APP_WORKER} is off Cloudflare.\n`);
