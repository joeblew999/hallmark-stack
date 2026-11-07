// From Gateweave Track (github.com/gateweavehq/track) at b8b5ba0: apps/web/src/server/auth/config.ts, the parts for an
// app whose only way in is Gateweave ID (issue #3). Left out, because courts has none of them: email and password,
// email verification and password reset (ID does those), GitHub, workspaces (the organization plugin and its hooks,
// its disabled paths), agents and MCP, the demo, deleting an account (ID's), and telling sync sockets about ended
// sessions.
import type { BetterAuthRateLimitOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type { Database } from "../db";
import { schema } from "../db";
import { type OidcProvider, oidcDatabaseHooks, oidcSignIn } from "./oidc-sign-in";
import { DISABLED_ROUTES } from "./routes";

export interface AuthConfig {
	db: Database;
	secret: string;
	baseURL?: string | undefined;
	/**
	 * Marks cookies `Secure` whatever the base URL says. Without a pinned `baseURL`, Better Auth
	 * decides from NODE_ENV, which a Worker never has, and leaves the attribute off.
	 */
	secureCookies?: boolean | undefined;
	/** Gateweave ID, the only way in. Without it nobody can sign in. */
	oidc?: OidcProvider | undefined;
	/** Where rate limits are counted. This isolate's memory without it. */
	rateLimitStorage?: BetterAuthRateLimitOptions["customStorage"];
}

/**
 * Builds the Better Auth instance. Kept free of `cloudflare:workers` imports so the Better Auth
 * CLI can load it to generate the database schema (src/server/auth/cli.ts).
 */
export function createAuth(config: AuthConfig) {
	const oidcHooks = oidcDatabaseHooks();

	return betterAuth({
		secret: config.secret,
		baseURL: config.baseURL,
		database: drizzleAdapter(config.db, { provider: "sqlite", schema }),
		telemetry: { enabled: false },
		// Every Better Auth route courts doesn't use is off (routes.ts).
		disabledPaths: [...DISABLED_ROUTES],
		// Better Auth only turns its limiter on by itself when NODE_ENV is "production", which a
		// Worker never sets. Its built-in rules allow 3 sign-ins per 10 seconds per client. It
		// stays on in local dev too, so what works there works deployed.
		rateLimit: {
			enabled: true,
			...DEFAULT_AUTH_LIMIT,
			...(config.rateLimitStorage && { customStorage: config.rateLimitStorage }),
		},
		advanced: {
			ipAddress: {
				// Cloudflare sets this to the address it saw. Clients can add to X-Forwarded-For,
				// and Better Auth puts every request whose address it cannot trust in one bucket.
				ipAddressHeaders: ["cf-connecting-ip"],
			},
			// Only the attribute: `useSecureCookies` would also rename the cookies to `__Secure-...`,
			// which signs everyone out.
			...(config.secureCookies && { defaultCookieAttributes: { secure: true } }),
			// Opaque ids, never readable ones.
			database: {
				generateId: () => crypto.randomUUID(),
				// From Track v0.30.3 (gateweavehq/track#231): each query is a trip to the D1's one primary, so a session
				// and its person are read in one, with nothing read any staler.
				joins: true,
			},
		},
		session: {
			additionalFields: {
				/** The provider's session this one came from, which its logout tokens name. */
				oidcSid: { type: "string", required: false, input: false, returned: false, index: true },
			},
		},
		databaseHooks: {
			account: oidcHooks.account,
			session: { create: oidcHooks.session.create },
		},
		plugins: [
			...(config.oidc ? oidcSignIn(config.db, config.oidc) : []),
			// Must stay last: forwards Set-Cookie headers from server-side auth calls.
			tanstackStartCookies(),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;

/** What a client may send to an auth path that has no rule of its own: Better Auth's default. */
export const DEFAULT_AUTH_LIMIT = { window: 10, max: 100 };
