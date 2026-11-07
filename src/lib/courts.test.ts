import { describe, expect, it } from "vitest";
import { bookableDays, COURTS, courtById } from "./courts";

describe("bookableDays", () => {
	it("starts with today in the venue's time zone", () => {
		// 2026-11-07 20:00 UTC is already the 8th in Bangkok (UTC+7).
		const days = bookableDays(new Date("2026-11-07T20:00:00Z"), "Asia/Bangkok");
		expect(days.map((d) => d.date)).toEqual([
			"2026-11-08",
			"2026-11-09",
			"2026-11-10",
			"2026-11-11",
		]);
		expect(days.map((d) => d.label)).toEqual(["Today", "Tomorrow", "Tuesday", "Wednesday"]);
	});
});

describe("courts", () => {
	it("have unique opaque ids", () => {
		const ids = COURTS.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids)
			expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(courtById(ids[2] ?? "")?.name).toBe("Court 3");
	});
});
