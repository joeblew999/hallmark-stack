// The deployable environments, Cloudflare's way (issue #9): wrangler.jsonc's top level is development and is never
// deployed; staging and production are its env blocks, and Gateweave ID's (id.jsonc). Every deploy, register and
// undeploy script starts with chooseEnvironment(), which sets CLOUDFLARE_ENV once for every Wrangler and Vite command
// it runs: Wrangler takes it for every command (args.env ?? getCloudflareEnv() in its config loading), and refuses a
// build made for another environment.

export const ENVIRONMENTS = ["staging", "production"];

/** Where each environment's D1 databases are made: next to the venue's people, in Thailand (issue #5). */
export const LOCATION = "apac";

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
