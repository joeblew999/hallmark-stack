// Sign in and sign out without the page's script: "Sign in" is a plain link to GET /sign-in?next=<path>, and "Sign out"
// a plain form that posts to /sign-out. So the first press works the moment it is on screen, like every other link,
// instead of waiting for the page to hydrate (Track's LiveButton, which this replaces: until the script loaded, the
// button sat disabled and a press did nothing, about ten seconds on a dev server behind Tailscale, under two on
// staging).
//
// Each one is Better Auth's own endpoint, called through handleAuthRequest exactly as the browser called it before,
// so the rate limit, the origin check and the cookies are unchanged: /api/auth/sign-in/social (provider oidc) and
// /api/auth/sign-out. Their answer's cookies are passed on, and the browser is redirected (303) where it was going.
import { handleAuthRequest } from "./index";
import { OIDC_PROVIDER } from "./oidc-sign-in";

/** Where a refused or failed sign-in comes back to, saying why in words of ours (src/routes/login.tsx). */
const REFUSED = "/login";

/** A path on this site only: a `next` that names another site, or none, goes to the home page. */
function samePath(next: string | null): string {
	return next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

/** One call to a Better Auth endpoint, as this browser, from this site. */
function asThisBrowser(request: Request, path: string, body: unknown) {
	const url = new URL(request.url);
	const headers = new Headers({ "content-type": "application/json", origin: url.origin });
	for (const name of ["cookie", "cf-connecting-ip", "user-agent"]) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	return handleAuthRequest(
		new Request(new URL(path, url), { method: "POST", headers, body: JSON.stringify(body) }),
	);
}

/** A redirect carrying the cookies Better Auth set (the sign-in's state, or the cleared session). */
function redirect(to: string, from: Response, base: string): Response {
	const headers = new Headers({ location: new URL(to, base).href });
	for (const cookie of from.headers.getSetCookie()) headers.append("set-cookie", cookie);
	return new Response(null, { status: 303, headers });
}

/** GET /sign-in?next=<path>: straight to Gateweave ID, and back to `next` once signed in. */
export async function signIn(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const answer = await asThisBrowser(request, "/api/auth/sign-in/social", {
		provider: OIDC_PROVIDER,
		callbackURL: samePath(url.searchParams.get("next")),
		errorCallbackURL: REFUSED,
	});
	const to = answer.ok ? ((await answer.json()) as { url?: string }).url : undefined;
	// No ID (not set up, or down): the sign-in page says so, as the button did.
	return redirect(to ?? `${REFUSED}?error=unavailable`, answer, url.origin);
}

/** POST /sign-out: this site's session ended (Gateweave ID's stays), then the home page. */
export async function signOut(request: Request): Promise<Response> {
	const url = new URL(request.url);
	// Only this site's own form: a post from anywhere else signs nobody out.
	if (request.headers.get("origin") !== url.origin) return new Response(null, { status: 403 });
	const answer = await asThisBrowser(request, "/api/auth/sign-out", {});
	return redirect("/", answer, url.origin);
}
