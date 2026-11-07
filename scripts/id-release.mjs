// Gateweave ID (github.com/gateweavehq/id): its pinned release, its address, the fetch of that release into the
// git-ignored vendor/gateweave-id, and its own Wrangler. ID only; used by the id-* and app-* scripts that reach ID.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

/** ID's release, from github.com/gateweavehq/id/releases; checked 2026-11-07 (commit bd1d4e6). */
export const ID_RELEASE = "v0.10.4";
/** Where ID answers: a Workers Custom Domain on ubuntusoftware.net (issue #2). */
export const ID_DOMAIN = "id.ubuntusoftware.net";
/** ID's Turnstile widget, by name, so id:deploy finds it again and id:undeploy deletes it. */
export const ID_TURNSTILE_WIDGET = "gateweave-id";

export const ID_ROOT = "vendor/gateweave-id";
export const ID_WEB = join(ID_ROOT, "apps/web");

/** ID's pinned release in vendor/gateweave-id, its packages installed with aube from ID's own pnpm-lock.yaml. */
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
