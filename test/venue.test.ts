import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { COURTS } from "../src/lib/courts";

// Real workerd, real SQLite in the Durable Object: no mocks.
const court = COURTS[0]?.id ?? "";
const other = COURTS[1]?.id ?? "";
const venue = (name: string) => env.VENUE.get(env.VENUE.idFromName(name));
const TODAY = "2026-11-07";

describe("VenueDO", () => {
	it("books a free court and shows it taken at that hour only", async () => {
		const v = venue("book");
		const result = await v.book("user-a", court, TODAY, "19:00", TODAY);
		expect(result.ok).toBe(true);
		const taken = await v.taken([TODAY]);
		expect(taken[`${TODAY} 19:00`]).toEqual([court]);
		expect(taken[`${TODAY} 18:00`]).toEqual([]);
	});

	it("refuses a second booking of the same court, date and hour", async () => {
		const v = venue("double");
		expect((await v.book("user-a", court, TODAY, "20:00", TODAY)).ok).toBe(true);
		expect(await v.book("user-b", court, TODAY, "20:00", TODAY)).toEqual({
			ok: false,
			reason: "taken",
		});
		// Another court at the same hour is fine.
		expect((await v.book("user-b", other, TODAY, "20:00", TODAY)).ok).toBe(true);
	});

	it("refuses unknown courts, odd hours, bad dates and the past", async () => {
		const v = venue("invalid");
		expect(await v.book("u", crypto.randomUUID(), TODAY, "19:00", TODAY)).toEqual({
			ok: false,
			reason: "invalid",
		});
		expect(await v.book("u", court, TODAY, "16:00", TODAY)).toEqual({
			ok: false,
			reason: "invalid",
		});
		expect(await v.book("u", court, "7 Nov", "19:00", TODAY)).toEqual({
			ok: false,
			reason: "invalid",
		});
		expect(await v.book("u", court, "2026-11-06", "19:00", TODAY)).toEqual({
			ok: false,
			reason: "past",
		});
	});

	it("lists only the user's own bookings, and only they can cancel them", async () => {
		const v = venue("mine");
		const booked = await v.book("user-a", court, TODAY, "17:00", TODAY);
		if (!booked.ok) throw new Error("booking failed");
		await v.book("user-b", other, TODAY, "17:00", TODAY);
		expect((await v.bookingsOf("user-a", TODAY)).map((b) => b.courtId)).toEqual([court]);
		expect(await v.cancel("user-b", booked.booking.id)).toBe(false);
		expect(await v.cancel("user-a", booked.booking.id)).toBe(true);
		expect(await v.bookingsOf("user-a", TODAY)).toEqual([]);
	});

	it("prunes bookings before a date", async () => {
		const v = venue("prune");
		await v.book("u", court, "2026-12-01", "19:00", TODAY);
		await v.book("u", court, "2026-12-03", "19:00", TODAY);
		expect(await v.prune("2026-12-02")).toBe(1);
		expect(Object.values(await v.taken(["2026-12-01", "2026-12-03"])).flat()).toEqual([court]);
	});
});
