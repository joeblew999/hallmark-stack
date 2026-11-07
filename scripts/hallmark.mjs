// Hallmark's sloplint on the running production build: starts `vite preview` (after `aube run build`), lints the
// stylesheets with the page as rendered at eight widths, then stops it. Fails on any FAIL, REFLEX or WARN.
// Run: aube run hallmark
import { spawn, spawnSync } from "node:child_process";

const PORT = 4713;
const preview = spawn("vite", ["preview", "--port", String(PORT), "--strictPort"], {
	stdio: "ignore",
});
let status = 1;
try {
	for (let i = 0; i < 60; i++) {
		await new Promise((r) => setTimeout(r, 500));
		const ok = await fetch(`http://localhost:${PORT}/`)
			.then((r) => r.ok)
			.catch(() => false);
		if (ok) break;
	}
	const lint = spawnSync(
		"node",
		[
			".claude/skills/hallmark/scripts/sloplint.mjs",
			"src/styles.css",
			"src/styles",
			"--url",
			`http://localhost:${PORT}/`,
			"--render",
			"--genre",
			"editorial",
		],
		{ encoding: "utf8" },
	);
	process.stdout.write(lint.stdout);
	process.stderr.write(lint.stderr);
	status = lint.status === 0 && /clean\. 0 FAIL, 0 REFLEX, 0 WARN/.test(lint.stdout) ? 0 : 1;
} finally {
	preview.kill();
}
process.exit(status);
