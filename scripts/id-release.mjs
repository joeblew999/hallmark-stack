// Gateweave ID (github.com/gateweavehq/id): its pinned release, its address, the fetch of that release into the
// git-ignored vendor/gateweave-id, and its own Wrangler. ID only; used by the id-* and app-* scripts that reach ID.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

/** ID's release, from github.com/gateweavehq/id/releases, the newest on 2026-11-07, when it was checked. */
export const ID_RELEASE = "v0.10.6";
/** The commit that tag named then. A tag can be moved; the commit can't, so it is checked on every fetch. */
export const ID_COMMIT = "793ce73c1ce8d33d829db30d9c56bd97d8a536c2";
/** Where ID answers: a Workers Custom Domain on ubuntusoftware.net (issue #2). */
export const ID_DOMAIN = "id.ubuntusoftware.net";
/** ID's Turnstile widget, by name, so id:deploy finds it again and id:undeploy deletes it. */
export const ID_TURNSTILE_WIDGET = "gateweave-id";

export const ID_ROOT = "vendor/gateweave-id";
export const ID_WEB = join(ID_ROOT, "apps/web");

/**
 * ID's pinned release in vendor/gateweave-id, its packages installed with aube from ID's own pnpm-lock.yaml. Stops if
 * the tag no longer names the pinned commit.
 */
export function fetchId() {
	const at = existsSync(ID_ROOT)
		? spawnSync("git", ["describe", "--tags", "--exact-match"], {
				cwd: ID_ROOT,
				encoding: "utf8",
			}).stdout.trim()
		: "";
	if (at !== ID_RELEASE) {
		rmSync(ID_ROOT, { recursive: true, force: true });
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
}

/** ID's own pinned Wrangler (its script), for scripts/cloudflare.mjs's remove(). */
export const ID_WRANGLER = resolve(ID_WEB, "node_modules/wrangler/bin/wrangler.js");

/** ID's own pinned Wrangler, run from ID's root, where its wrangler.jsonc is. */
export const idWrangler = (args, options = {}) =>
	execFileSync("node", ["apps/web/node_modules/wrangler/bin/wrangler.js", ...args], {
		cwd: ID_ROOT,
		...options,
	});
