// Optional settings. Secrets are in `secrets.required` (wrangler.jsonc's top level, development), which `wrangler types`
// turns into the rest of Cloudflare.Env: BETTER_AUTH_SECRET, and OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET,
// sign-in through Gateweave ID, which needs all three (mise run app:register sets them). On staging and production
// those three arrive after the first deploy, so src/server/auth/index.ts checks they are there.
declare namespace Cloudflare {
	interface Env {
		/** What the sign-in button calls it. Default: Gateweave ID. */
		OIDC_PROVIDER_NAME?: string;
	}
}
