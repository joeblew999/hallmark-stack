import { expect, test } from "@playwright/test";
import { DISABLED_ROUTES } from "../src/server/auth/routes";

// Every Better Auth route courts doesn't use answers 404 (src/server/auth/routes.ts), and the ones that don't depend
// on Gateweave ID still answer. This build has no ID settings, so signing in and ID's logouts are mise run all:e2e.

/** The method each route takes; the rest take POST. */
const GET = new Set(["/list-sessions", "/list-accounts", "/account-info", "/verify-email"]);

test("Better Auth's routes that courts doesn't use answer 404", async ({ request }) => {
	for (const route of DISABLED_ROUTES) {
		const method = GET.has(route) ? "GET" : "POST";
		const answer = await request.fetch(`/api/auth${route}`, {
			method,
			headers: { origin: "http://localhost" },
			...(method === "POST" && { data: {} }),
		});
		expect(answer.status(), `${method} ${route}`).toBe(404);
	}
});

test("the routes courts uses without Gateweave ID still answer", async ({ request }) => {
	expect((await request.get("/api/auth/ok")).status()).toBe(200);
	expect((await request.get("/api/auth/get-session")).status()).toBe(200);
});
