import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Real workerd, real SQLite in the Durable Object: no mocks. One object for every client (src/server/rate-limit/).
const limiter = (name: string) => env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(name));
const THREE_IN_TEN = [{ window: 10, max: 3 }];

describe("RateLimiter", () => {
	it("allows each client its own burst, then refuses that client only", async () => {
		const l = limiter("burst");
		for (let i = 0; i < 3; i++) expect((await l.consume("a", THREE_IN_TEN)).allowed).toBe(true);
		const refused = await l.consume("a", THREE_IN_TEN);
		expect(refused.allowed).toBe(false);
		expect(refused.retryAfter).toBeGreaterThan(0);
		expect((await l.consume("b", THREE_IN_TEN)).allowed).toBe(true);
	});

	it("forgets a client once its allowance is whole again", async () => {
		const l = limiter("forget");
		await l.consume("a", THREE_IN_TEN);
		const rows = () =>
			runInDurableObject(l, (_, state) =>
				state.storage.sql.exec("SELECT key FROM allowance").toArray(),
			);
		expect(await rows()).toHaveLength(1);
		// The row is whole again in 10/3 seconds; the alarm runs once that has passed.
		await runInDurableObject(l, (_, state) =>
			state.storage.sql.exec("UPDATE allowance SET refilled_at = ?", Date.now() - 1),
		);
		expect(await runDurableObjectAlarm(l)).toBe(true);
		expect(await rows()).toHaveLength(0);
	});
});
