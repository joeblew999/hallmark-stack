import { defineConfig, devices } from "@playwright/test";
import { DEVELOPMENT, ENVIRONMENTS, local } from "./scripts/environments.mjs";

// The live suite: one environment's courts through its own Gateweave ID, in installed Chrome, with no human (mise run
// all:e2e <env>, which is `--project <env>`). No webServer: it tests what Cloudflare serves, or, for development, what
// `mise run all:dev` is serving on this machine. Its own
// config because Playwright's webServer is config-wide. One test at a time: the flows share two people, and their
// sign-outs come last.
//
// One project per environment, named after it:
//   staging      everything: two throwaway people are invited into ID (staging:people), sign in, book, sign out,
//                and are deleted afterwards (staging:cleanup), with anything a killed run left.
//   production   only what reads (pairing.spec.ts): both answer and are paired. Nobody is made or deleted, and
//                nothing is booked, on the site real people use.
//   development  everything, as staging, against mise run all:dev's local pair.
//
// The project picked is the environment: it is put in ENVIRONMENT here, and CLOUDFLARE_ENV for a deployed one (Wrangler's
// top level is development), before anything runs, so the global setup, every test (e2e/live/target.ts) and every
// Wrangler call they make inherit it.
const picked = process.argv.flatMap((arg, i, argv) =>
	arg === "--project" ? [argv[i + 1]] : arg.startsWith("--project=") ? [arg.slice(10)] : [],
);
// Playwright loads this file again in each test worker, without the command line: there the environment is the one the
// main process already put in CLOUDFLARE_ENV, which every worker inherits (TEST_WORKER_INDEX is set only in workers).
const env =
	process.env.TEST_WORKER_INDEX !== undefined
		? (process.env.ENVIRONMENT ?? "")
		: picked.length === 1
			? (picked[0] ?? "")
			: "";
const named = [...ENVIRONMENTS, DEVELOPMENT];
if (!named.includes(env)) {
	throw new Error(
		`Pick one environment: --project ${named.join(" or --project ")} (mise run all:e2e <env>).`,
	);
}
process.env.ENVIRONMENT = env;
if (local(env)) delete process.env.CLOUDFLARE_ENV;
else process.env.CLOUDFLARE_ENV = env;

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
		// Its own NO_PROXY list is skipped, as every other tool skips it: development is on localhost.
		...(process.env.HTTPS_PROXY && {
			proxy: { server: process.env.HTTPS_PROXY, bypass: process.env.NO_PROXY ?? "localhost" },
		}),
	},
	projects: [
		{ name: "staging:people", testMatch: /people\.setup\.ts/, teardown: "staging:cleanup" },
		{ name: "staging:cleanup", testMatch: /people\.teardown\.ts/ },
		{ name: "staging", testMatch: /\.spec\.ts$/, dependencies: ["staging:people"] },
		{ name: "production", testMatch: /pairing\.spec\.ts$/ },
		{ name: "development:people", testMatch: /people\.setup\.ts/, teardown: "development:cleanup" },
		{ name: "development:cleanup", testMatch: /people\.teardown\.ts/ },
		{ name: "development", testMatch: /\.spec\.ts$/, dependencies: ["development:people"] },
	],
});
