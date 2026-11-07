import { COURTS, type Day, HOURS } from "./courts";

/**
 * Sample availability, the same fixed pattern the Hallmark build used, until bookings are stored. Keyed
 * `${date} ${hour}`, each the taken court ids.
 */
export function sampleTaken(days: Day[]): Record<string, string[]> {
	const taken: Record<string, string[]> = {};
	days.forEach((day, d) => {
		for (const hour of HOURS) {
			const t = Number.parseInt(hour, 10);
			taken[`${day.date} ${hour}`] = COURTS.filter((_, i) => (d * 7 + t * 3 + i * 5) % 9 < 3).map((c) => c.id);
		}
	});
	return taken;
}
