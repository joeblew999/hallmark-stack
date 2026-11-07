// What the live suite runs against, from the deploy scripts' own settings: courts' address and D1, and Gateweave ID's
// address and D1, for the environment in CLOUDFLARE_ENV (staging or production), which every Wrangler call here
// inherits. Nothing here is written twice. The tests ask this file, never for a URL of their own.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { appConfig } from "../../scripts/app-config.mjs";
import { APP_WRANGLER } from "../../scripts/cloudflare.mjs";
import { ENVIRONMENTS } from "../../scripts/environments.mjs";
import { idConfig, idWrangler } from "../../scripts/id-release.mjs";

/** The environment under test: staging or production, never the development top level. */
export const ENV = process.env.CLOUDFLARE_ENV ?? "";
if (!ENVIRONMENTS.includes(ENV)) {
	throw new Error(`CLOUDFLARE_ENV must be one of ${ENVIRONMENTS.join(", ")}, not "${ENV}".`);
}
export const COURTS = `https://${appConfig(ENV).domain}`;
export const ID = `https://${idConfig(ENV).domain}`;

/** Where one run keeps its two people and their signed-in browsers. Git-ignored. */
export const STATE = "e2e/live/.state";
export const stateOf = (who: "a" | "b") => join(STATE, `${who}.json`);

/** Every test person's address starts so, which is how a run finds what an earlier, killed run left behind. */
export const PREFIX = "e2e-";
export const LIKE = `'${PREFIX}%@example.com'`;

export type Person = { name: string; email: string };
export const people = (): { a: Person; b: Person } =>
	JSON.parse(readFileSync(join(STATE, "people.json"), "utf8"));

/** One SQL statement on Gateweave ID's D1, answered as rows. */
export function inId(sql: string): Record<string, unknown>[] {
	const out = idWrangler(["d1", "execute", "DB", "--remote", "--json", "--command", sql], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	return JSON.parse(String(out))[0].results;
}

/** One SQL statement on courts' D1, answered as rows. */
export function inCourts(sql: string): Record<string, unknown>[] {
	const run = spawnSync(
		"node",
		[APP_WRANGLER, "d1", "execute", "DB", "--remote", "--json", "--command", sql],
		{ encoding: "utf8" },
	);
	if (run.status !== 0) throw new Error(`courts' D1 refused: ${run.stderr}`);
	return JSON.parse(run.stdout)[0].results;
}

/** Opens a courts page and waits until React has hydrated it (the root sets data-hydrated). */
export async function open(page: Page, path: string) {
	await page.goto(`${COURTS}${path}`);
	await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

/** Whether this page's browser is signed in at `origin`, by Better Auth's own session check there. */
export async function signedIn(page: Page, origin: string) {
	const answer = await page.context().request.get(`${origin}/api/auth/get-session`);
	return (await answer.json()) !== null;
}
