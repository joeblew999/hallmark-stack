// Hallmark's sloplint on the running production build: starts `vite preview` (after `aube run build`), lints the
// stylesheets with every page as rendered at eight widths, then stops it. Fails on any FAIL, REFLEX or WARN.
// The home page is a page; /login and /bookings are app screens (Hallmark's references/flow.md: behind a sign-in,
// forms and controls), so `--scope app`, which steps the landing-page gates aside and keeps the rest.
// Signed out here; signed in is `mise run all:e2e`, on the live site.
// Run: aube run hallmark
import { spawn, spawnSync } from "node:child_process";

const PORT = 4713;
const RUNS = [
	{ scope: "page", paths: ["/"] },
	{ scope: "app", paths: ["/login", "/bookings"] },
];

const preview = spawn("vite", ["preview", "--port", String(PORT), "--strictPort"], {
	stdio: "ignore",
});
let status = 0;
try {
	for (let i = 0; i < 60; i++) {
		await new Promise((r) => setTimeout(r, 500));
		const ok = await fetch(`http://localhost:${PORT}/`)
			.then((r) => r.ok)
			.catch(() => false);
		if (ok) break;
	}
	for (const { scope, paths } of RUNS) {
		const lint = spawnSync(
			"node",
			[
				".claude/skills/hallmark/scripts/sloplint.mjs",
				"src/styles.css",
				"src/styles",
				...paths.flatMap((p) => ["--url", `http://localhost:${PORT}${p}`]),
				"--render",
				"--genre",
				"editorial",
				"--scope",
				scope,
			],
			{ encoding: "utf8" },
		);
		process.stdout.write(lint.stdout);
		process.stderr.write(lint.stderr);
		if (lint.status !== 0 || !/clean\. 0 FAIL, 0 REFLEX, 0 WARN/.test(lint.stdout)) status = 1;
	}
} finally {
	preview.kill();
}
process.exit(status);
