// Gateweave ID (github.com/gateweavehq/id): its pinned release, the fetch of that release into the git-ignored
// vendor/gateweave-id with our environments written into its wrangler.jsonc, and its own Wrangler. Used by the id-*
// and app-* scripts that reach ID, and the live suite.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	experimental_patchConfig,
	experimental_readRawConfig,
	unstable_readConfig,
} from "wrangler";
import { developmentOrigins, ENVIRONMENTS, local } from "./environments.mjs";

/** ID's release, from github.com/gateweavehq/id/releases, the newest on 2026-11-08, when it was checked. */
export const ID_RELEASE = "v0.12.0";
/** The commit that tag named then. A tag can be moved; the commit can't, so it is checked on every fetch. */
export const ID_COMMIT = "5c4b942a2d821055001ca682a2f86c3f8eded399";
export const ID_ROOT = "vendor/gateweave-id";
export const ID_WEB = join(ID_ROOT, "apps/web");

/**
 * ID's pinned release in vendor/gateweave-id, its packages installed with aube from ID's own pnpm-lock.yaml. Stops if
 * the tag no longer names the pinned commit. A new release is checked out in place, never re-cloned, so what isn't in
 * ID's git stays: the local ID's database and emails (apps/web/.wrangler) and its .dev.vars, so local accounts survive
 * an update.
 */
export function fetchId() {
	if (!existsSync(join(ID_ROOT, ".git"))) {
		execFileSync(
			"git",
			[
				"-c",
				"advice.detachedHead=false",
				"clone",
				"--depth",
				"1",
				"--branch",
				ID_RELEASE,
				"https://github.com/gateweavehq/id",
				ID_ROOT,
			],
			{ stdio: "inherit" },
		);
	}
	const at = spawnSync("git", ["describe", "--tags", "--exact-match"], {
		cwd: ID_ROOT,
		encoding: "utf8",
	}).stdout.trim();
	if (at !== ID_RELEASE) {
		execFileSync("git", ["fetch", "--depth", "1", "origin", "tag", ID_RELEASE, "--no-tags"], {
			cwd: ID_ROOT,
			stdio: "inherit",
		});
		execFileSync("git", ["-c", "advice.detachedHead=false", "checkout", "--force", ID_RELEASE], {
			cwd: ID_ROOT,
			stdio: "inherit",
		});
	}
	const commit = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: ID_ROOT,
		encoding: "utf8",
	}).trim();
	if (commit !== ID_COMMIT) {
		throw new Error(
			`Gateweave ID's ${ID_RELEASE} is now commit ${commit}, not the pinned ${ID_COMMIT}: check it before using it (scripts/id-release.mjs)`,
		);
	}
	execFileSync("aube", ["install", "--frozen-lockfile"], { cwd: ID_ROOT, stdio: "inherit" });
	writeEnvironments();
}

const ID_CONFIG = join(ID_ROOT, "wrangler.jsonc");

/**
 * Our environments, written into ID's wrangler.jsonc as fetched: our values from id.jsonc (name, domain, vars), and
 * ID's own bindings from its top level (D1, Durable Objects, email, cron, queue, secrets) with Wrangler's names for an
 * environment, so a new ID release brings its own bindings. Gateweave's own environments (cloud, staging) are removed,
 * so only ours can be deployed. Done on every fetch, so every script that reaches ID finds them.
 */
function writeEnvironments() {
	execFileSync("git", ["checkout", "--", "wrangler.jsonc"], { cwd: ID_ROOT });
	const theirs = experimental_readRawConfig({ config: ID_CONFIG }).rawConfig;
	const ours = experimental_readRawConfig({ config: "id.jsonc" }).rawConfig;
	const named = (theirName, env) => `${theirName.replace(theirs.name, ours.name)}-${env}`;
	const env = {};
	for (const name of Object.keys(theirs.env ?? {})) env[name] = undefined;
	experimental_patchConfig(ID_CONFIG, { name: ours.name, env }, false);
	const blocks = {};
	for (const each of ENVIRONMENTS) {
		blocks[each] = {
			placement: ours.env[each].placement,
			observability: ours.env[each].observability,
			routes: ours.env[each].routes,
			vars: ours.env[each].vars,
			d1_databases: theirs.d1_databases.map(({ database_id, ...d1 }) => ({
				...d1,
				database_name: named(d1.database_name, each),
			})),
			durable_objects: theirs.durable_objects,
			send_email: theirs.send_email,
			triggers: theirs.triggers,
			queues: {
				producers: theirs.queues.producers.map((q) => ({ ...q, queue: named(q.queue, each) })),
				consumers: theirs.queues.consumers.map((q) => ({ ...q, queue: named(q.queue, each) })),
			},
			secrets: theirs.secrets,
		};
	}
	experimental_patchConfig(ID_CONFIG, { env: blocks }, false);
}

/** One more var for ID's `env` (the Turnstile site key, issued at deploy), written into ID's wrangler.jsonc. */
export function setIdVar(env, name, value) {
	experimental_patchConfig(ID_CONFIG, { env: { [env]: { vars: { [name]: value } } } }, false);
}

/** ID's Worker, D1, logouts queue and Custom Domain for `env`, as Wrangler resolves them from ID's wrangler.jsonc. */
export function idConfig(env) {
	const config = unstable_readConfig({ config: ID_CONFIG, env });
	const domain = config.routes?.find(
		(route) => typeof route === "object" && route.custom_domain,
	)?.pattern;
	const database = config.d1_databases.find(({ binding }) => binding === "DB")?.database_name;
	const queue = config.queues?.producers?.[0]?.queue;
	if (!domain || !database || !queue)
		throw new Error(`ID's env.${env} has no Custom Domain, D1 or queue`);
	return { worker: config.name, database, queue, domain };
}

/** Where Gateweave ID answers in `env`: its Custom Domain, or development's address (scripts/environments.mjs). */
export const idOrigin = (env) =>
	local(env) ? developmentOrigins().id : `https://${idConfig(env).domain}`;

/** Where ID's D1 is for its Wrangler in `env`: the local one ID's own `dev` and `dev:setup` use, or Cloudflare's. */
export const idD1 = (env) =>
	local(env) ? ["--local", "--persist-to", join("apps/web", ".wrangler/state")] : ["--remote"];

/** ID's own pinned Wrangler (its script), for scripts/cloudflare.mjs's remove(). */
export const ID_WRANGLER = resolve(ID_WEB, "node_modules/wrangler/bin/wrangler.js");

/** ID's own pinned Wrangler, run from ID's root, where its wrangler.jsonc is. */
export const idWrangler = (args, options = {}) =>
	execFileSync("node", ["apps/web/node_modules/wrangler/bin/wrangler.js", ...args], {
		cwd: ID_ROOT,
		...options,
	});
