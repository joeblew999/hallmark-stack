import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { oidcProviderName, userOf } from "#/server/auth";
import { days, venue } from "#/server/venue";
import type { Booking, BookResult } from "#/server/venue-do";

// Durable Object RPC results are typed `T & Disposable`; each is given its plain type here, where it leaves the
// server, so TanStack Start serialises plain data.

/** The bookable days and which courts are taken at each hour, plus who is signed in. */
export const loadAvailability = createServerFn({ method: "GET" }).handler(async () => {
	const ds = days();
	const [taken, user] = await Promise.all([
		venue().taken(ds.map((d) => d.date)),
		userOf(getRequest()),
	]);
	const plain: Record<string, string[]> = { ...taken };
	return { days: ds, taken: plain, user: user ? { name: user.name, email: user.email } : null };
});

export type BookOutcome = BookResult | { ok: false; reason: "signed-out" };

export const bookCourt = createServerFn({ method: "POST" })
	.validator(
		z.object({ courtId: z.uuid(), date: z.iso.date(), hour: z.string().regex(/^\d{2}:00$/) }),
	)
	.handler(async ({ data }): Promise<BookOutcome> => {
		const user = await userOf(getRequest());
		if (!user) return { ok: false, reason: "signed-out" };
		const today = days()[0]?.date ?? data.date;
		const result = await venue().book(user.id, data.courtId, data.date, data.hour, today);
		return result.ok
			? { ok: true, booking: { ...result.booking } }
			: { ok: false, reason: result.reason };
	});

export const myBookings = createServerFn({ method: "GET" }).handler(async () => {
	const user = await userOf(getRequest());
	if (!user) return { user: null, bookings: [] as Booking[] };
	const today = days()[0]?.date ?? "";
	const rows = await venue().bookingsOf(user.id, today);
	const bookings: Booking[] = rows.map((b) => ({ ...b }));
	return { user: { name: user.name, email: user.email }, bookings };
});

export const cancelBooking = createServerFn({ method: "POST" })
	.validator(z.uuid())
	.handler(async ({ data }): Promise<boolean> => {
		const user = await userOf(getRequest());
		if (!user) return false;
		return venue().cancel(user.id, data);
	});

/** The sign-in page's options: the OpenID Connect provider's name, or null when none is set up. */
export const signInOptions = createServerFn({ method: "GET" }).handler(async () => ({
	provider: oidcProviderName(),
}));
