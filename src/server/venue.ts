import { env } from "cloudflare:workers";
import { bookableDays } from "#/lib/courts";

/** The venue's time zone: it decides what "today" is. */
export const VENUE_TIME_ZONE = "Asia/Bangkok";

/** The one venue there is: its Durable Object, by name. A second venue is a second name. */
export function venue() {
	return env.VENUE.get(env.VENUE.idFromName("eastfield"));
}

export function days(now = new Date()) {
	return bookableDays(now, VENUE_TIME_ZONE);
}
