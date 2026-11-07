import { env } from "cloudflare:workers";
import { createDb } from "../db";
import { createAuth } from "./config";

export const db = createDb(env.DB);

let instance: ReturnType<typeof createAuth> | undefined;

/** The isolate's one Better Auth instance, built on first use (workerd forbids I/O at module load). */
export function getAuth() {
	instance ??= createAuth({
		db,
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL || undefined,
		// A deployed Worker answers over HTTPS; local dev has no certificate.
		secureCookies: !env.BETTER_AUTH_URL && !import.meta.env.DEV,
		oidc: oidcProvider(),
	});
	return instance;
}

/** The signed-in user for a request, or null. */
export async function userOf(request: Request) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	return session?.user ?? null;
}

/** Gateweave ID (or any OpenID Connect provider), when all three settings are there. */
export function oidcProvider() {
	const { OIDC_ISSUER: issuer, OIDC_CLIENT_ID: clientId, OIDC_CLIENT_SECRET: clientSecret } = env;
	return issuer && clientId && clientSecret ? { issuer, clientId, clientSecret } : undefined;
}

/** What the sign-in button calls the provider, or null when there is none. */
export function oidcProviderName(): string | null {
	return oidcProvider() ? env.OIDC_PROVIDER_NAME || "Gateweave ID" : null;
}
