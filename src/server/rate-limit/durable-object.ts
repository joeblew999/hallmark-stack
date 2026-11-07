// From Gateweave Track (github.com/gateweavehq/track) at b8b5ba0: apps/web/src/server/rate-limit/durable-object.ts.
// Changed: one object holds every client's allowance, in its own table, instead of one object per client (issue #5).
// Track's object per key was created afresh for nearly every sign-in: a new client, or an old one whose allowance had
// refilled and been deleted, is a Durable Object that doesn't exist yet. On staging, 2026-11-07, a call to it took
// 621 ms (median of 7) against 37 ms of work inside it; a call to the bookings object, which always exists, took 24 ms.
// One object keeps Track's point, a limit that holds across every isolate and location, without that cost.
import { DurableObject } from "cloudflare:workers";
import { type Allowance, type Decision, type Rule, refilledAt, take } from "./gcra";

/**
 * Counts every client's sign-in requests, across every isolate and location: one instance, asked for by one name
 * (`RATE_LIMIT_NAME`), with each client's allowance a row of its own. `consume` never awaits, so concurrent requests
 * are decided one at a time.
 */
export class RateLimiter extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.storage.sql.exec(
			"CREATE TABLE IF NOT EXISTS allowance (key TEXT PRIMARY KEY, allowance TEXT NOT NULL, refilled_at INTEGER NOT NULL)",
		);
		ctx.storage.sql.exec(
			"CREATE INDEX IF NOT EXISTS allowance_refilled_at ON allowance (refilled_at)",
		);
	}

	consume(key: string, rules: Rule[]): Decision {
		const { sql } = this.ctx.storage;
		const [row] = sql
			.exec<{ allowance: string }>("SELECT allowance FROM allowance WHERE key = ?", key)
			.toArray();
		const before: Allowance = row ? JSON.parse(row.allowance) : {};
		const { decision, allowance } = take(before, rules, Date.now());
		if (decision.allowed) {
			const refilled = refilledAt(allowance);
			sql.exec(
				"INSERT INTO allowance (key, allowance, refilled_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET allowance = excluded.allowance, refilled_at = excluded.refilled_at",
				key,
				JSON.stringify(allowance),
				refilled,
			);
			void this.#alarmBy(refilled);
		}
		return decision;
	}

	/** Once a client's allowance is whole again, it is the same as none, so its row goes. */
	override async alarm(): Promise<void> {
		const { sql } = this.ctx.storage;
		sql.exec("DELETE FROM allowance WHERE refilled_at <= ?", Date.now());
		const [next] = sql
			.exec<{ at: number | null }>("SELECT MIN(refilled_at) AS at FROM allowance")
			.toArray();
		if (next?.at) await this.ctx.storage.setAlarm(next.at);
	}

	/** The alarm at the earliest time any allowance is whole again. */
	async #alarmBy(at: number) {
		const set = await this.ctx.storage.getAlarm();
		if (set === null || at < set) await this.ctx.storage.setAlarm(at);
	}
}
