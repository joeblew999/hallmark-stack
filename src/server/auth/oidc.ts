import { createAuthEndpoint } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { and, eq } from "drizzle-orm";
import { jwtVerify } from "jose";
import { z } from "zod";
import type { Database } from "../db";
import { schema } from "../db";

/**
 * Sign-in through an OpenID Connect provider: Gateweave ID (github.com/gateweavehq/id), or any other. Built on
 * Better Auth's generic-oauth plugin, configured the way Gateweave Track configures it for ID (Track's
 * apps/web/src/server/auth/oidc-sign-in.ts, at b8b5ba0): verified email only, the provider's discovery never
 * blocking password sign-in, and back-channel logout.
 *
 * The id is in the two URLs the provider is given (callback and logout), so it never changes.
 */
export const OIDC_PROVIDER = "oidc";

export interface OidcProvider {
	issuer: string;
	clientId: string;
	clientSecret: string;
}

export function oidcSignIn(db: Database, { issuer, clientId, clientSecret }: OidcProvider) {
	const config = {
		providerId: OIDC_PROVIDER,
		discoveryUrl: `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
		clientId,
		clientSecret,
		scopes: ["openid", "profile", "email"],
		pkce: true,
		requireIdTokenVerification: true,
		// client_secret_basic: the method every provider must accept.
		authentication: "basic" as const,
		// Signing out here leaves someone signed in at ID, for their other apps; signing out at ID reaches here
		// through the back-channel endpoint below.
		disableProviderLogout: true,
		mapProfileToUser: (profile: { email?: unknown; email_verified?: unknown; name?: unknown }) => ({
			// Linking to an existing account rests on this; some providers send the string "false".
			emailVerified: profile.email_verified === true,
			name:
				typeof profile.name === "string" && profile.name
					? profile.name
					: String(profile.email ?? ""),
		}),
	};
	const plugin = genericOAuth({ config: [config] });
	return [
		{
			...plugin,
			// The plugin's own init awaits the provider's discovery document with no time limit, and every request
			// in a fresh isolate waits for init: a slow ID would stall password sign-in and every session check.
			// Starting as the plugin does after a failed discovery makes it fetch discovery on first use instead.
			// This sets a field of the plugin's that isn't public, as Track's does: check it when Better Auth moves.
			init: async () => ({
				context: { genericOAuthPendingDiscovery: new Map([[OIDC_PROVIDER, { config }]]) },
			}),
		},
		backchannelLogout(db),
	];
}

const LOGOUT_EVENT = "http://schemas.openid.net/event/backchannel-logout";

const logoutClaims = z
	.object({
		sub: z.string().min(1).optional(),
		sid: z.string().min(1).optional(),
		events: z.object({ [LOGOUT_EVENT]: z.looseObject({}) }),
		// With `events`, this keeps an ID token from passing as a logout token.
		nonce: z.never().optional(),
	})
	.refine((claims) => claims.sub || claims.sid);

/**
 * POST /api/auth/backchannel-logout/oidc: the provider calls it with a signed logout token when someone signs
 * out there, and every session of theirs here ends. A token naming only a provider session (sid, no sub) can't be
 * matched to a person here, so it is answered and changes nothing.
 */
function backchannelLogout(db: Database) {
	return {
		id: "oidc-backchannel-logout",
		endpoints: {
			oidcBackchannelLogout: createAuthEndpoint(
				"/backchannel-logout/:id",
				{
					method: "POST",
					body: z.object({ logout_token: z.string().max(8192).optional() }),
					metadata: { allowedMediaTypes: ["application/x-www-form-urlencoded"] },
				},
				async (ctx) => {
					ctx.setHeader("cache-control", "no-store");
					const answer = (status: 200 | 400 | 404 | 503) => {
						ctx.setStatus(status);
						return status === 200
							? {}
							: { error: status === 503 ? "temporarily_unavailable" : "invalid_request" };
					};
					if (ctx.params.id !== OIDC_PROVIDER) return answer(404);
					const token = ctx.body.logout_token;
					if (!token) return answer(400);
					// Before discovery has worked there are no keys to check with: a provider retries a 503.
					const provider = ctx.context.socialProviders.find(({ id }) => id === OIDC_PROVIDER);
					const keys = provider?.idToken;
					if (!keys || !("jwks" in keys)) return answer(503);

					let claims: z.infer<typeof logoutClaims>;
					try {
						const { payload } = await jwtVerify(token, keys.jwks, {
							issuer: keys.issuer,
							audience: keys.audience,
							requiredClaims: ["iat", "exp"],
							maxTokenAge: "5 minutes",
							clockTolerance: "30 seconds",
						});
						claims = logoutClaims.parse(payload);
					} catch {
						return answer(400);
					}
					if (!claims.sub) return answer(200);
					const owner = await db
						.select({ userId: schema.account.userId })
						.from(schema.account)
						.where(
							and(
								eq(schema.account.providerId, OIDC_PROVIDER),
								eq(schema.account.accountId, claims.sub),
							),
						)
						.get();
					if (owner) await ctx.context.internalAdapter.deleteUserSessions(owner.userId);
					return answer(200);
				},
			),
		},
	};
}
