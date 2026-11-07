// Removing things from Cloudflare, for app-undeploy.mjs and id-undeploy.mjs: each delete is simply tried, and Cloudflare
// says whether the thing was there.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

/** This app's own pinned Wrangler (its script). ID's is ID_WRANGLER in scripts/id-release.mjs. */
export const APP_WRANGLER = resolve("node_modules/wrangler/bin/wrangler.js");

/**
 * Deletes one thing on Cloudflare with the given Wrangler, run from `cwd` (where its wrangler.jsonc is), and says what
 * it removed. Something already gone ("not found", "does not exist") is reported and skipped; any other failure stops.
 */
export function remove(what, args, { wrangler, cwd = "." }) {
	const result = spawnSync("node", [wrangler, ...args], { cwd, encoding: "utf8", input: "y\n" });
	if (result.status === 0) {
		console.log(`Removed ${what}.`);
		return;
	}
	const said = `${result.stdout}\n${result.stderr}`;
	if (/not found|does not exist|couldn't find|no such/i.test(said)) {
		console.log(`${what[0]?.toUpperCase()}${what.slice(1)} was already gone.`);
		return;
	}
	console.error(said);
	throw new Error(`Couldn't remove ${what}.`);
}
