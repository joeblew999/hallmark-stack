// Hallmark's own lint (sloplint, .claude/skills/hallmark/scripts/) on the production build that Playwright's webServer
// is already serving, rendered at Hallmark's widths. The home page is a page; /login and /bookings are app screens
// (Hallmark's references/flow.md: behind a sign-in, forms and controls), so `--scope app`, which steps the
// landing-page gates aside and keeps the rest. Signed out here; signed in is `mise run all:e2e`, on the live site.
import { spawn } from "node:child_process";
import { expect, test } from "@playwright/test";

const RUNS = [
	{ scope: "page", paths: ["/"] },
	{ scope: "app", paths: ["/login", "/bookings"] },
];

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

test("Hallmark's lint is clean on every page", async ({ baseURL }) => {
	if (!baseURL) throw new Error("No baseURL: Playwright's webServer is what Hallmark lints");
	// The two runs share nothing but the server, so they run side by side.
	const outputs = await Promise.all(
		RUNS.map(({ scope, paths }) => sloplint(baseURL, scope, paths)),
	);
	for (const [i, output] of outputs.entries()) {
		// The whole of Hallmark's report is the failure message, so its findings show in the test report.
		expect(output, `Hallmark, --scope ${RUNS[i]?.scope}:\n${output}`).toMatch(
			/clean\. 0 FAIL, 0 REFLEX, 0 WARN[\s\S]*\(sloplint exited 0\)$/,
		);
	}
});
