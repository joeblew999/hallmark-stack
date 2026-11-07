/**
 * The venue's courts and bookable hours. Sample data: the Eastfield name, the layout and the sports are the
 * Hallmark build's samples (README.md, "Not real yet"). Ids are opaque UUIDs, never names, so a court can be
 * renamed without touching a booking.
 */

export type Sport = "tennis" | "padel" | "five-a-side";

export interface Court {
	id: string;
	name: string;
	/** How the court is named inside a sentence: "Book court 3 at 19:00". */
	short: string;
	sport: Sport;
}

export const COURTS: readonly Court[] = [
	{
		id: "0b8f7c1e-5d4a-4c1e-9a51-1f0d2c6a9e01",
		name: "Court 1",
		short: "court 1",
		sport: "tennis",
	},
	{
		id: "6a3e2d90-7b1f-4f0c-8e2a-2b9c4d5e6f02",
		name: "Court 2",
		short: "court 2",
		sport: "tennis",
	},
	{
		id: "c4d1a7b2-3e8f-4a9d-b6c5-3d0e1f2a7b03",
		name: "Court 3",
		short: "court 3",
		sport: "tennis",
	},
	{
		id: "91f2e3d4-c5b6-4a7e-8d9f-4e1a2b3c8d04",
		name: "Court 4",
		short: "court 4",
		sport: "tennis",
	},
	{
		id: "d7e8f9a0-b1c2-4d3e-9f4a-5f2b3c4d9e05",
		name: "Court 5",
		short: "court 5",
		sport: "tennis",
	},
	{ id: "2c3d4e5f-6a7b-4c8d-a9e0-6a3c4d5e0f06", name: "Padel A", short: "padel A", sport: "padel" },
	{ id: "8e9f0a1b-2c3d-4e5f-b6a7-7b4d5e6f1a07", name: "Padel B", short: "padel B", sport: "padel" },
	{
		id: "f1a2b3c4-d5e6-4f7a-8b9c-8c5e6f7a2b08",
		name: "The pitch",
		short: "the pitch",
		sport: "five-a-side",
	},
];

/** Start times, on the hour. */
export const HOURS = ["17:00", "18:00", "19:00", "20:00", "21:00"] as const;
export type Hour = (typeof HOURS)[number];

export interface Day {
	/** ISO date, YYYY-MM-DD: what a booking stores. */
	date: string;
	/** What the page shows: Today, Tomorrow, then the weekday. */
	label: string;
}

/** The four days the booker offers, from `now`, in the venue's time zone. */
export function bookableDays(now: Date, timeZone: string): Day[] {
	const iso = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const weekday = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long" });
	return [0, 1, 2, 3].map((offset) => {
		const at = new Date(now.getTime() + offset * 86_400_000);
		const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : weekday.format(at);
		return { date: iso.format(at), label };
	});
}

export function courtById(id: string): Court | undefined {
	return COURTS.find((court) => court.id === id);
}
