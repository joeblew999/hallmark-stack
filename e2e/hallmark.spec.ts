// Hallmark's own lint (sloplint, .claude/skills/hallmark/scripts/) on the production build that Playwright's webServer
// is already serving, rendered at Hallmark's widths: every route TanStack Router has (scripts/routes.mjs), each at its
// scope in src/lib/pages.ts (SCOPES): "page" is read, "app" is worked in (Hallmark's references/flow.md), which steps
// the landing-page gates aside and keeps the rest. A route with no scope there fails. Signed out here; signed in is
// `mise run all:e2e <env>`.
import { spawn } from "node:child_process";
import { expect, test } from "@playwright/test";
import { routePaths } from "../scripts/routes.mjs";
import { SCOPES } from "../src/lib/pages";
import { hallmarkClean } from "./hallmark-verdict";

const routes = routePaths();
const unscoped = routes.filter((path) => !SCOPES[path]);
const RUNS = (["page", "app"] as const).map((scope) => ({
	scope,
	paths: routes.filter((path) => SCOPES[path] === scope),
}));

/** One sloplint run, as Hallmark's SKILL.md gives it for a framework project with its server running. */
function sloplint(baseURL: string, scope: string, paths: string[]) {
	return new Promise<string>((done) => {
		const child = spawn("node", [
			".claude/skills/hallmark/scripts/sloplint.mjs",
			"src/styles.css",
			"src/styles",
			...paths.flatMap((path) => ["--url", new URL(path, baseURL).href]),
			"--render",
			"--genre",
			"editorial",
			"--scope",
			scope,
		]);
		let out = "";
		child.stdout.on("data", (chunk) => {
			out += chunk;
		});
		child.stderr.on("data", (chunk) => {
			out += chunk;
		});
		child.on("close", (code) => done(`${out}\n(sloplint exited ${code})`));
	});
}

test("every route has its Hallmark scope in src/lib/pages.ts", () => {
	expect(unscoped, "routes with no scope in src/lib/pages.ts (SCOPES)").toEqual([]);
});

test("Hallmark's lint is clean on every page", async ({ baseURL }) => {
	if (!baseURL) throw new Error("No baseURL: Playwright's webServer is what Hallmark lints");
	// The two runs share nothing but the server, so they run side by side.
	const outputs = await Promise.all(
		RUNS.map(({ scope, paths }) => sloplint(baseURL, scope, paths)),
	);
	for (const [i, output] of outputs.entries()) {
		// The whole of Hallmark's report is the failure message, so its findings show in the test report.
		expect(hallmarkClean(output), `Hallmark, --scope ${RUNS[i]?.scope}:\n${output}`).toBe(true);
	}
});
