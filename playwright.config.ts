import { defineConfig, devices } from "@playwright/test";

// Port 4711 keeps clear of `aube run dev` (4710). As in Track, the tests run the production build (vite build, then
// vite preview): the Worker in workerd, D1 and the Durable Object local (miniflare), Better Auth for real. Every test
// signs up its own user, so they share one server.
const PORT = Number(process.env.E2E_PORT) || 4711;

export default defineConfig({
	testDir: "e2e",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
	use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
	// Google Chrome as installed (macOS, GitHub's Ubuntu runners), so no browser download is needed.
	projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
	webServer: {
		command: `node scripts/dev-setup.mjs && vite build && vite preview --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}/login`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
