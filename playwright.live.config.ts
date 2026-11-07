import { defineConfig, devices } from "@playwright/test";

// The live suite: the deployed courts through the deployed Gateweave ID, in installed Chrome, with no human
// (mise run all:e2e). No webServer: it tests what Cloudflare serves. Its own config because Playwright's webServer is
// config-wide. One test at a time: the flows share two people, and their sign-outs come last.
export default defineConfig({
	testDir: "e2e/live",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: "list",
	globalSetup: "./e2e/live/global-setup.ts",
	use: {
		...devices["Desktop Chrome"],
		channel: "chrome",
		trace: "retain-on-failure",
		// Chrome goes through the proxy when there is one (a Claude cloud session, whose Chrome trusts it); on a Mac, none.
		...(process.env.HTTPS_PROXY && { proxy: { server: process.env.HTTPS_PROXY } }),
	},
	projects: [
		{ name: "people", testMatch: /people\.setup\.ts/, teardown: "cleanup" },
		{ name: "cleanup", testMatch: /people\.teardown\.ts/ },
		{ name: "live", testMatch: /\.spec\.ts$/, dependencies: ["people"] },
	],
});
