// Optional settings. Required secrets are in `secrets.required` (wrangler.jsonc), which `wrangler types` turns into
// the rest of Cloudflare.Env.
declare namespace Cloudflare {
	interface Env {
		/** The app's public URL. Inferred from each request when unset. */
		BETTER_AUTH_URL?: string;
		/**
		 * Sign-in through Gateweave ID (or any OpenID Connect provider): its issuer URL and this app's client id and
		 * secret there. Needs all three. `mise run id:deploy` sets them as this Worker's secrets.
		 */
		OIDC_ISSUER?: string;
		OIDC_CLIENT_ID?: string;
		OIDC_CLIENT_SECRET?: string;
		/** What the sign-in button calls it. Default: Gateweave ID. */
		OIDC_PROVIDER_NAME?: string;
	}
}
