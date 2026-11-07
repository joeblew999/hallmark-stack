import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type { Database } from "../db";
import { schema } from "../db";

export interface AuthConfig {
	db: Database;
	secret: string;
	baseURL?: string | undefined;
	/** Marks cookies Secure. A Worker has no NODE_ENV, so Better Auth cannot tell production by itself. */
	secureCookies?: boolean | undefined;
}

/**
 * Builds the Better Auth instance: email and password, sessions in D1. Free of `cloudflare:workers` imports so the
 * Better Auth CLI can load it to generate the schema (src/server/auth/cli.ts).
 */
export function createAuth(config: AuthConfig) {
	return betterAuth({
		secret: config.secret,
		baseURL: config.baseURL,
		database: drizzleAdapter(config.db, { provider: "sqlite", schema }),
		emailAndPassword: { enabled: true, minPasswordLength: 10 },
		advanced: {
			useSecureCookies: config.secureCookies,
			database: { generateId: () => crypto.randomUUID() },
		},
		plugins: [tanstackStartCookies()],
	});
}
