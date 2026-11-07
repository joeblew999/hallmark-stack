// From Gateweave Track (github.com/gateweavehq/track) at b8b5ba0: apps/web/src/server/auth/index.ts, the parts for an
// app whose only way in is Gateweave ID (issue #3): the one Better Auth instance, counting each request by who sent
// it, and seeing a back-channel logout through. Track's workspaces, email, GitHub, MCP and demo are left out.
import { env, waitUntil } from "cloudflare:workers";
import { createDb } from "../db";
import { authRateLimits } from "../rate-limit";
import { createAuth } from "./config";
import { countedByWhoSentIt } from "./workers-address";

export const db = createDb(env.DB);

const baseURL = env.BETTER_AUTH_URL || undefined;

/** Gateweave ID, when all three settings are there (`mise run app:register` sets them). */
const oidc =
	env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET
		? {
				issuer: env.OIDC_ISSUER,
				clientId: env.OIDC_CLIENT_ID,
				clientSecret: env.OIDC_CLIENT_SECRET,
			}
		: undefined;

let instance: ReturnType<typeof buildAuth> | undefined;

/**
 * The isolate's one Better Auth instance, built on first use: workerd forbids I/O in global
 * scope, so building at module load would log an error on every cold start.
 */
export function getAuth() {
	instance ??= buildAuth();
	return instance;
}

function buildAuth() {
	return createAuth({
		db,
		secret: env.BETTER_AUTH_SECRET,
		baseURL,
		// A deployed Worker answers over HTTPS. Local dev has no certificate.
		secureCookies: !baseURL && !import.meta.env.DEV,
		oidc,
		rateLimitStorage: authRateLimits,
	});
}

/**
 * Everything from outside reaches Better Auth through here, because its handler counts a request
 * first of all, before anything in it can step in.
 */
export async function handleAuthRequest(request: Request): Promise<Response> {
	return getAuth().handler(await countedByWhoSentIt(request));
}

const PROVIDER_LOGOUT = "/api/auth/backchannel-logout/";

/**
 * Takes a POST for Better Auth. A provider waits only so long for the answer to a logout token, and
 * its giving up would cancel the request, leaving someone signed in here after signing out there.
 * So a logout is seen through once it has arrived, and read first, while the sender is still there.
 */
export async function postToAuth(request: Request): Promise<Response> {
	if (!new URL(request.url).pathname.startsWith(PROVIDER_LOGOUT)) {
		return handleAuthRequest(request);
	}
	const arrived = new Request(request.url, {
		method: "POST",
		headers: request.headers,
		body: await request.arrayBuffer(),
	});
	const answer = handleAuthRequest(arrived);
	waitUntil(answer);
	return answer;
}

/** The signed-in user for a request, or null. */
export async function userOf(request: Request) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	return session?.user ?? null;
}

/** What the sign-in button calls the provider, or null when there is none and so no way in. */
export const oidcProviderName = oidc ? env.OIDC_PROVIDER_NAME || "Gateweave ID" : null;

/** Gateweave ID's account page, where people change their details, password and sign-in. */
export const idAccountUrl = oidc ? new URL("/account", oidc.issuer).href : null;
