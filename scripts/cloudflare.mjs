// Shared by the deploy and undeploy scripts: remove() takes a thing off Cloudflare (each delete is simply tried, and
// Cloudflare says whether the thing was there); waitUntilUp() proves a deploy by asking its real address.
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

/**
 * A deploy Cloudflare accepted can still not work (a missing secret, a bad migration, a certificate not issued yet), so
 * each deploy asks its real address: every 5 seconds for up to two minutes, until `check(response, body)` passes.
 * Anything else stops the deploy.
 */
export async function waitUntilUp(what, url, check = (response) => response.ok) {
	const until = Date.now() + 120_000;
	let last = "no answer";
	while (Date.now() < until) {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
			if (check(response, await response.text())) {
				console.log(`${what} is up: ${url}`);
				return;
			}
			last = `HTTP ${response.status}`;
		} catch (error) {
			last = error.cause?.code ?? error.message;
		}
		await new Promise((done) => setTimeout(done, 5_000));
	}
	throw new Error(`${what} isn't up after two minutes (${url}: ${last}).`);
}
