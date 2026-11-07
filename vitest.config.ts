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
				// The Durable Object in workerd, with the real wrangler.jsonc's bindings and settings; the entry is
				// test/worker.ts, because the real one is TanStack Start's server.
				resolve: { tsconfigPaths: true },
				plugins: [
					cloudflareTest({
						main: "./test/worker.ts",
						wrangler: { configPath: "./wrangler.jsonc" },
					}),
				],
				test: { name: "worker", include: ["test/*.test.ts"] },
			},
		],
	},
});
