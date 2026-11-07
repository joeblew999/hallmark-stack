import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		projects: [
			{
				// Pure logic, in Node.
				resolve: { tsconfigPaths: true },
				test: { name: "unit", include: ["src/**/*.test.ts"] },
			},
			{
				// The Durable Object in workerd (test/wrangler.jsonc), as Track tests its own.
				resolve: { tsconfigPaths: true },
				plugins: [cloudflareTest({ wrangler: { configPath: "./test/wrangler.jsonc" } })],
				test: { name: "worker", include: ["test/*.test.ts"] },
			},
			{
				// The built Worker in workerd, driven from Node (test/app/courts-worker.ts), as Track tests its
				// sign-in. Building takes a while.
				test: {
					name: "app",
					include: ["test/app/**/*.test.ts"],
					globalSetup: ["./test/app/global-setup.ts"],
					testTimeout: 30_000,
					hookTimeout: 60_000,
				},
			},
		],
	},
});
