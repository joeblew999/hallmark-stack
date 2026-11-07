// Read-only: courts and its Gateweave ID are up, and courts signs in through that ID and no other. Nothing is made or
// changed, so this is the whole of what runs against production.
import { expect, test } from "@playwright/test";
import { COURTS, ID } from "./target";

test("courts answers (Better Auth's own health route)", async ({ request }) => {
	const answer = await request.get(`${COURTS}/api/auth/ok`);
	expect(await answer.json()).toEqual({ ok: true });
});

test("Gateweave ID's sign-in provider answers, with its own issuer", async ({ request }) => {
	const answer = await request.get(`${ID}/.well-known/openid-configuration`);
	expect((await answer.json()).issuer).toBe(ID);
});

test("courts' Sign in goes to that Gateweave ID's login page, for courts' client", async ({
	request,
}) => {
	const start = await request.post(`${COURTS}/api/auth/sign-in/social`, {
		headers: { origin: COURTS },
		data: { provider: "oidc", callbackURL: "/" },
	});
	const authorize = new URL((await start.json()).url);
	expect(authorize.origin).toBe(ID);
	expect(authorize.searchParams.get("client_id")).toBeTruthy();
	// To a script, ID answers with the address as JSON; to a browser, with a redirect. Either is its login page.
	const answer = await request.get(authorize.href, { maxRedirects: 0 });
	const where = answer.headers().location ?? (await answer.json()).url;
	const login = new URL(where, authorize);
	expect(`${login.origin}${login.pathname}`).toBe(`${ID}/login`);
});
