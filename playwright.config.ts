import { defineConfig, devices } from "@playwright/test";

// Port 4711 keeps clear of `aube run dev` (4710). As in Track, the tests run the production build (vite build, then
// vite preview): the Worker in workerd, D1 and the Durable Object local, Better Auth for real, nobody signed in.
const PORT = Number(process.env.E2E_PORT) || 4711;

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
	use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
	// Google Chrome as installed (macOS, GitHub's Ubuntu runners), so no browser download is needed.
	projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
	webServer: {
		// The build is `aube run build`, which `aube run ci` runs first; this only serves it.
		command: `node scripts/dev-setup.mjs && vite preview --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}/login`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
