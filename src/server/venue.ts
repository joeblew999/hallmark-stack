import { env } from "cloudflare:workers";
import { bookableDays } from "#/lib/courts";

/** The venue's time zone: it decides what "today" is. */
export const VENUE_TIME_ZONE = "Asia/Bangkok";

/** The one venue there is, by an opaque id, never a name, so renaming it can't touch its bookings. */
export const VENUE_ID = "7ef77086-533e-4e61-a02c-e3521a52684a";

/**
 * The venue's Durable Object. It starts where wrangler.jsonc says (vars.LOCATION), next to the venue's people, rather
 * than wherever its first request happens to come from, such as a deploy run in another continent (issue #5). The hint
 * only counts when the object is first made.
 */
export function venue() {
	return env.VENUE.get(env.VENUE.idFromName(VENUE_ID), {
		locationHint: env.LOCATION as DurableObjectLocationHint,
	});
}

export function days(now = new Date()) {
	return bookableDays(now, VENUE_TIME_ZONE);
}
