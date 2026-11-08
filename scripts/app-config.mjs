// This app's identity on Cloudflare and at Gateweave ID, in one place: its Worker, D1 database, address and location
// for an environment, read from wrangler.jsonc as Wrangler reads it, and its id and name at ID. Used by app-deploy.mjs,
// app-register.mjs, app-undeploy.mjs and the live suite (e2e/live/target.ts).
import { unstable_readConfig } from "wrangler";
import { developmentOrigins, local } from "./environments.mjs";

/** The Worker, its D1 database, its Custom Domain and where its data lives, for `env`, as Wrangler resolves them. */
export function appConfig(env) {
	const config = unstable_readConfig({ config: "wrangler.jsonc", env });
	const domain = config.routes?.find(
		(route) => typeof route === "object" && route.custom_domain,
	)?.pattern;
	const database = config.d1_databases.find(({ binding }) => binding === "DB")?.database_name;
	if (!domain || !database) throw new Error(`wrangler.jsonc env.${env} has no Custom Domain or D1`);
	return { worker: config.name, database, domain, location: config.vars?.LOCATION };
}

/** This app's id at each Gateweave ID, and its name on ID's pages. */
export const APP_ID = "courts";
export const APP_NAME = "Eastfield Courts";

/** Where courts answers in `env`: its Custom Domain, or development's address (scripts/environments.mjs). */
export const appOrigin = (env) =>
	local(env) ? developmentOrigins().app : `https://${appConfig(env).domain}`;

/** Where courts' D1 is for Wrangler in `env`: the local one `vite dev` uses, or Cloudflare's. */
export const appD1 = (env) => (local(env) ? ["--local"] : ["--remote"]);
