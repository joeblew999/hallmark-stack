// The deployable environments, Cloudflare's way (issue #9): wrangler.jsonc's top level is development and is never
// deployed; staging and production are its env blocks, and Gateweave ID's (id.jsonc). Every deploy, register and
// undeploy script starts with chooseEnvironment(), which sets CLOUDFLARE_ENV once for every Wrangler and Vite command
// it runs: Wrangler takes it for every command (args.env ?? getCloudflareEnv() in its config loading), and refuses a
// build made for another environment.

export const ENVIRONMENTS = ["staging", "production"];

/** Where each environment's D1 databases are made: next to the venue's people, in Thailand (issue #5). */
export const LOCATION = "apac";
/** Where every Worker runs, whoever calls it: next to its D1 in LOCATION (Workers placement, issue #5). Each request
 * makes several D1 queries, and by default a Worker runs next to its caller, so a caller far from the D1 paid one long
 * round trip per query (210 ms each from the US). aws:ap-northeast-1 is Tokyo, the cloud region measured nearest
 * Asia-Pacific's D1s: on courts-staging, 2026-11-07, D1 queries took 71-74 ms placed there, 80-107 ms at Hong Kong
 * (aws:ap-east-1), 125-157 ms at Singapore (aws:ap-southeast-1). Measure again if Cloudflare moves APAC D1. */
export const PLACEMENT = "aws:ap-northeast-1";

/** The environment this run is for, from the task's argument (mise passes it), or CLOUDFLARE_ENV. */
export function chooseEnvironment() {
	const env = process.argv[2] || process.env.CLOUDFLARE_ENV || "";
	if (!ENVIRONMENTS.includes(env)) {
		console.error(
			`Which environment: ${ENVIRONMENTS.join(" or ")}? Got "${env}". (wrangler.jsonc's top level is development, which is never deployed.)`,
		);
		process.exit(2);
	}
	process.env.CLOUDFLARE_ENV = env;
	return env;
}
