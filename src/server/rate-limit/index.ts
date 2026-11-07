// From Gateweave Track (github.com/gateweavehq/track) at b8b5ba0: apps/web/src/server/rate-limit/index.ts, the parts
// for sign-in only. Track's limits on its demo, request forms and email are left out: courts has none of those.
// Changed: one rate-limiter object for every client, not one per client (issue #5, durable-object.ts).
import { env } from "cloudflare:workers";
import type { BetterAuthRateLimitOptions } from "better-auth";
import { DEFAULT_AUTH_LIMIT } from "../auth/config";
import { type Decision, LocalLimiter, type Rule } from "./gcra";

export { RateLimiter } from "./durable-object";

/**
 * Each auth rule also gets an hourly allowance of this many times its burst, so a client cannot
 * keep going by pacing itself to the short window: sign-in attempts are held to 60 an hour
 * instead of 3 every 10 seconds, which would be 1,080.
 */
export const HOURLY_MULTIPLE = 20;

const local = new LocalLimiter();

/** The one rate-limiter object's name. */
export const RATE_LIMIT_NAME = "sign-in";

/**
 * Better Auth's rate limit storage. Better Auth counts per client address and path. Paths with
 * a rule of their own (sign-in, sign-up, password reset, invitations, OAuth) are counted in a
 * Durable Object, one for every client, so their limits hold across every isolate and location; in memory, each
 * isolate would give an attacker a fresh allowance. Everything else, mostly session checks,
 * keeps the default limit in this isolate, which costs nothing per request.
 */
export const authRateLimits: NonNullable<BetterAuthRateLimitOptions["customStorage"]> = {
	async consume(key, rule) {
		if (rule.window === DEFAULT_AUTH_LIMIT.window && rule.max === DEFAULT_AUTH_LIMIT.max) {
			return local.consume(key, [rule], Date.now());
		}
		return consumeDurably(`auth:${key}`, [
			rule,
			{ window: 60 * 60, max: rule.max * HOURLY_MULTIPLE },
		]);
	},
};

async function consumeDurably(key: string, rules: Rule[]): Promise<Decision> {
	try {
		// Keys hold addresses, so they are hashed before they are stored. One object for them all, made in LOCATION
		// (issue #5, durable-object.ts).
		return await env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(RATE_LIMIT_NAME), {
			locationHint: env.LOCATION as DurableObjectLocationHint,
		}).consume(await sha256(key), rules);
	} catch (error) {
		// Counting in this isolate alone is weaker, but better than refusing everyone or no one.
		console.error("rate limit: Durable Object unavailable, counting in this isolate", error);
		return local.consume(key, rules, Date.now());
	}
}

async function sha256(text: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
