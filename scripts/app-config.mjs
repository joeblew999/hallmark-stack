// This app's identity on Cloudflare and at Gateweave ID, in one place: its Worker, D1 database and address from its own
// wrangler.jsonc, and its id and name at ID. Used by app-deploy.mjs, app-register.mjs and app-undeploy.mjs.
import { readFileSync } from "node:fs";

const config = readFileSync("wrangler.jsonc", "utf8");
const pick = (pattern, what) => {
	const value = pattern.exec(config)?.[1];
	if (!value) throw new Error(`wrangler.jsonc has no ${what}`);
	return value;
};

/** The Worker's name, its D1 database and its Custom Domain, as wrangler.jsonc sets them. */
export const APP_WORKER = pick(/"name":\s*"([^"]+)"/, "Worker name");
export const APP_DATABASE = pick(/"database_name":\s*"([^"]+)"/, "D1 database_name");
export const APP_DOMAIN = pick(/"pattern":\s*"([^"]+)"/, "route pattern");

/** This app's id at Gateweave ID, and its name on ID's pages. */
export const APP_ID = "courts";
export const APP_NAME = "Eastfield Courts";
