import { defineConfig, devices } from "@playwright/test";

// Port 4711 keeps clear of `aube run dev` (4710). As in Track, the tests run the production build (vite build, then
// vite preview): the Worker in workerd, D1 and the Durable Object local, Better Auth for real, nobody signed in.
const PORT = Number(process.env.E2E_PORT) || 4711;

export default defineConfig({
	testDir: "e2e",
	// e2e/live/ is the live suite (playwright.live.config.ts, mise run all:e2e), never CI's.
	testIgnore: "live/**",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
	use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
	// Google Chrome as installed (macOS, GitHub's Ubuntu runners), so no browser download is needed.
	projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
	webServer: {
		// The build is `aube run build`, which `aube run ci` runs first; this only serves it, with the suite's own vars
		// (scripts/e2e-vars.mjs: no Gateweave ID), and the local D1 migrated (dev:setup).
		command: `node scripts/dev-setup.mjs && node scripts/e2e-vars.mjs && vite preview --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}/login`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
