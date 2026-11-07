import { defineConfig, devices } from "@playwright/test";
import { ENVIRONMENTS } from "./scripts/environments.mjs";

// The live suite: one environment's deployed courts through its deployed Gateweave ID, in installed Chrome, with no
// human (mise run all:e2e <env>, which is `--project <env>`). No webServer: it tests what Cloudflare serves. Its own
// config because Playwright's webServer is config-wide. One test at a time: the flows share two people, and their
// sign-outs come last.
//
// One project per environment, named after it:
//   staging      everything: two throwaway people are invited into ID (staging:people), sign in, book, sign out,
//                and are deleted afterwards (staging:cleanup), with anything a killed run left.
//   production   only what reads (pairing.spec.ts): both answer and are paired. Nobody is made or deleted, and
//                nothing is booked, on the site real people use.
//
// The project picked is the environment: it is put in CLOUDFLARE_ENV here, before anything runs, so the global
// setup, every test (e2e/live/target.ts) and every Wrangler call they make inherit it.
const picked = process.argv.flatMap((arg, i, argv) =>
	arg === "--project" ? [argv[i + 1]] : arg.startsWith("--project=") ? [arg.slice(10)] : [],
);
const env = picked.length === 1 ? (picked[0] ?? "") : "";
if (!ENVIRONMENTS.includes(env)) {
	throw new Error(
		`Pick one environment: --project ${ENVIRONMENTS.join(" or --project ")} (mise run all:e2e <env>).`,
	);
}
process.env.CLOUDFLARE_ENV = env;

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
		{ name: "staging:people", testMatch: /people\.setup\.ts/, teardown: "staging:cleanup" },
		{ name: "staging:cleanup", testMatch: /people\.teardown\.ts/ },
		{ name: "staging", testMatch: /\.spec\.ts$/, dependencies: ["staging:people"] },
		{ name: "production", testMatch: /pairing\.spec\.ts$/ },
	],
});
