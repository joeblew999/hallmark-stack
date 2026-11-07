import { DurableObject } from "cloudflare:workers";
import { COURTS, HOURS } from "#/lib/courts";

export interface Booking {
	id: string;
	courtId: string;
	date: string;
	hour: string;
	userId: string;
	createdAt: number;
}

export type BookResult =
	| { ok: true; booking: Booking }
	| { ok: false; reason: "taken" | "invalid" | "past" };

/**
 * One venue's bookings. Every booking for the venue goes through this one object, and SQLite's unique index on
 * (court, date, hour) makes a double booking impossible: the second insert fails, and the caller is told the court
 * is taken. Handlers stay synchronous (the SQL API is), so each runs to the end before the next starts.
 */
export class VenueDO extends DurableObject<Cloudflare.Env> {
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS booking (
				id TEXT PRIMARY KEY,
				court_id TEXT NOT NULL,
				date TEXT NOT NULL,
				hour TEXT NOT NULL,
				user_id TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				UNIQUE (court_id, date, hour)
			)`);
			this.ctx.storage.sql.exec(
				"CREATE INDEX IF NOT EXISTS booking_user ON booking (user_id, date)",
			);
		});
	}

	/** Taken court ids for each `${date} ${hour}` on the given dates. */
	taken(dates: string[]): Record<string, string[]> {
		const out: Record<string, string[]> = {};
		for (const date of dates) for (const hour of HOURS) out[`${date} ${hour}`] = [];
		if (dates.length === 0) return out;
		const rows = this.ctx.storage.sql
			.exec<{ court_id: string; date: string; hour: string }>(
				`SELECT court_id, date, hour FROM booking WHERE date IN (${dates.map(() => "?").join(",")})`,
				...dates,
			)
			.toArray();
		for (const row of rows) out[`${row.date} ${row.hour}`]?.push(row.court_id);
		return out;
	}

	book(userId: string, courtId: string, date: string, hour: string, today: string): BookResult {
		if (!COURTS.some((c) => c.id === courtId) || !(HOURS as readonly string[]).includes(hour)) {
			return { ok: false, reason: "invalid" };
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, reason: "invalid" };
		if (date < today) return { ok: false, reason: "past" };
		const booking: Booking = {
			id: crypto.randomUUID(),
			courtId,
			date,
			hour,
			userId,
			createdAt: Date.now(),
		};
		try {
			this.ctx.storage.sql.exec(
				"INSERT INTO booking (id, court_id, date, hour, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
				booking.id,
				courtId,
				date,
				hour,
				userId,
				booking.createdAt,
			);
		} catch (error) {
			if (String(error).includes("UNIQUE")) return { ok: false, reason: "taken" };
			throw error;
		}
		return { ok: true, booking };
	}

	/** Someone's bookings from `today` on, soonest first. */
	bookingsOf(userId: string, today: string): Booking[] {
		return this.ctx.storage.sql
			.exec<{
				id: string;
				court_id: string;
				date: string;
				hour: string;
				user_id: string;
				created_at: number;
			}>("SELECT * FROM booking WHERE user_id = ? AND date >= ? ORDER BY date, hour", userId, today)
			.toArray()
			.map((r) => ({
				id: r.id,
				courtId: r.court_id,
				date: r.date,
				hour: r.hour,
				userId: r.user_id,
				createdAt: r.created_at,
			}));
	}

	/** Cancels a booking of the user's own; returns whether there was one. */
	cancel(userId: string, bookingId: string): boolean {
		return (
			this.ctx.storage.sql.exec(
				"DELETE FROM booking WHERE id = ? AND user_id = ?",
				bookingId,
				userId,
			).rowsWritten > 0
		);
	}

	/** Deletes bookings before `before` (the daily cron keeps a month). */
	prune(before: string): number {
		return this.ctx.storage.sql.exec("DELETE FROM booking WHERE date < ?", before).rowsWritten;
	}
}
