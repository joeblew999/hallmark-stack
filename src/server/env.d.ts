// Optional settings. Required secrets are in `secrets.required` (wrangler.jsonc), which `wrangler types` turns into
// the rest of Cloudflare.Env.
declare namespace Cloudflare {
	interface Env {
		/** The app's public URL. Inferred from each request when unset. */
		BETTER_AUTH_URL?: string;
	}
}
