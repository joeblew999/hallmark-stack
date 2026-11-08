import { env } from "cloudflare:workers";
import handler from "@tanstack/react-start/server-entry";
import { handleAuthRequest, postToAuth } from "./server/auth";
import { signIn, signOut } from "./server/auth/sign-in-out";
import { days, venue } from "./server/venue";

export { RateLimiter } from "./server/rate-limit";
export { VenueDO } from "./server/venue-do";

/** Without the database or the secret nothing can work; say so rather than sign with Better Auth's default. */
function notSetUp() {
	return new Response(
		"This deployment has no database or no BETTER_AUTH_SECRET, so it serves nothing.\n",
		{
			status: 503,
			headers: { "content-type": "text/plain; charset=utf-8" },
		},
	);
}

export default {
	fetch(request) {
		if (!env.DB || !env.BETTER_AUTH_SECRET) return notSetUp();
		const url = new URL(request.url);
		// As Track's routes/api/auth/$.ts: a POST may be a back-channel logout, seen through after its sender stops waiting.
		if (url.pathname.startsWith("/api/auth/")) {
			return request.method === "POST" ? postToAuth(request) : handleAuthRequest(request);
		}
		// Sign in and out without the page's script (src/server/auth/sign-in-out.ts).
		if (url.pathname === "/sign-in" && request.method === "GET") return signIn(request);
		if (url.pathname === "/sign-out" && request.method === "POST") return signOut(request);
		return handler.fetch(request);
	},
	// Daily: bookings older than a month go.
	async scheduled() {
		const monthAgo = days(new Date(Date.now() - 30 * 86_400_000))[0]?.date;
		if (monthAgo) await venue().prune(monthAgo);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
