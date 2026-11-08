import { readFileSync } from "node:fs";

// The deployable environments, Cloudflare's way (issue #9): wrangler.jsonc's top level is development and is never
// deployed; staging and production are its env blocks, and Gateweave ID's (id.jsonc). Every deploy, register and
// undeploy script starts with chooseEnvironment(), which sets CLOUDFLARE_ENV once for every Wrangler and Vite command
// it runs: Wrangler takes it for every command (args.env ?? getCloudflareEnv() in its config loading), and refuses a
// build made for another environment.

export const ENVIRONMENTS = ["staging", "production"];

/**
 * Development: wrangler.jsonc's and ID's top level, run on this machine by `mise run all:dev`, never deployed. The same
 * pair as staging and production (Gateweave ID and courts), on Gateweave's local ports (Track 4710, ID 4730; ID's
 * AGENTS.md), each with its own local D1 in .wrangler/state. The same scripts serve it: only where things are changes,
 * and `local(env)` is where they ask.
 */
export const DEVELOPMENT = "development";
/** Where each runs on this machine: its port, for `vite dev` and for Tailscale Funnel to forward to. */
export const LOCAL = { app: "http://localhost:4710", id: "http://localhost:4730" };
export const local = (env) => env === DEVELOPMENT;

/** Where mise run all:dev's Tailscale Funnel put the pair on the internet (scripts/tailscale.mjs). */
export const ORIGINS = ".tailscale/origins.json";

/**
 * Development's addresses: Tailscale Funnel's while all:dev has it up (.tailscale/origins.json), so the pair is opened
 * from any browser, sign-in included; this machine's (LOCAL) otherwise.
 */
export function developmentOrigins() {
	try {
		const { app, id } = JSON.parse(readFileSync(ORIGINS, "utf8"));
		if (app && id) return { app, id };
	} catch {}
	return LOCAL;
}

/** Where each environment's D1 databases are made: next to the venue's people, in Thailand (issue #5). */
export const LOCATION = "apac";
/** Where every Worker runs, whoever calls it: next to its D1 in LOCATION (Workers placement, issue #5). Each request
 * makes several D1 queries, and by default a Worker runs next to its caller, so a caller far from the D1 paid one long
 * round trip per query (210 ms each from the US). aws:ap-northeast-1 is Tokyo, the cloud region measured nearest
 * Asia-Pacific's D1s: on courts-staging, 2026-11-07, D1 queries took 71-74 ms placed there, 80-107 ms at Hong Kong
 * (aws:ap-east-1), 125-157 ms at Singapore (aws:ap-southeast-1). Measure again if Cloudflare moves APAC D1. */
export const PLACEMENT = "aws:ap-northeast-1";

/**
 * The environment this run is for, from the task's argument (mise passes it), or ENVIRONMENT. A script that also serves
 * development says so (`{ development: true }`); deploying never does. ENVIRONMENT is set for everything it runs, and
 * CLOUDFLARE_ENV for every Wrangler and Vite command, except in development, which is Wrangler's top level.
 */
export function chooseEnvironment({ development = false } = {}) {
	const env = process.argv[2] || process.env.ENVIRONMENT || process.env.CLOUDFLARE_ENV || "";
	const allowed = development ? [...ENVIRONMENTS, DEVELOPMENT] : ENVIRONMENTS;
	if (!allowed.includes(env)) {
		console.error(
			`Which environment: ${allowed.join(" or ")}? Got "${env}".${development ? "" : " (Development is wrangler.jsonc's top level, run by mise run all:dev, never deployed.)"}`,
		);
		process.exit(2);
	}
	process.env.ENVIRONMENT = env;
	if (local(env)) delete process.env.CLOUDFLARE_ENV;
	else process.env.CLOUDFLARE_ENV = env;
	return env;
}
