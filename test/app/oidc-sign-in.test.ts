// From Gateweave Track (github.com/gateweavehq/track) at b8b5ba0: apps/web/test/oidc-sign-in.test.ts, the cases for an
// app whose only way in is Gateweave ID (issue #3). Track's cases for its own password accounts (linking, signing in
// with a password while the provider is down), for sync sockets and for its demo are left out. New here: name and
// email are taken from ID at every sign-in.
// The real ID is tested end to end by `mise run all:e2e`.
import type { JWTPayload } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startCourts } from "./courts-worker";
import { LOGOUT_EVENT, OIDC, OIDC_VARS, standInProvider } from "./oidc-provider";

// The app never trusts the provider beyond what it signed: every refused sign-in must leave no
// session behind. A provider that is down must not touch anything but its own button, and its
// logout tokens must end the sessions they name and no others.

const origin = "https://courts.test";

type Provider = Awaited<ReturnType<typeof standInProvider>>;
type Courts = Awaited<ReturnType<typeof startCourts>>;

function cookieOf(response: Response) {
	return response.headers
		.getSetCookie()
		.map((each) => each.split(";")[0])
		.join("; ");
}

/** Each test comes from its own address, because sign-ins are limited per address. */
let clients = 0;
function newClient() {
	clients += 1;
	return `198.51.100.${clients}`;
}

function authApi(
	courts: Courts,
	path: string,
	init: { client: string; cookie?: string; body: object },
) {
	return courts.fetch(`${origin}/api/auth${path}`, {
		method: "POST",
		headers: {
			origin,
			"cf-connecting-ip": init.client,
			"content-type": "application/json",
			...(init.cookie && { cookie: init.cookie }),
		},
		body: JSON.stringify(init.body),
	});
}

/** Presses the button: where the app sends the browser, and the cookie that binds the way back. */
async function pressButton(courts: Courts, client: string) {
	const response = await authApi(courts, "/sign-in/social", {
		client,
		body: { provider: "oidc", callbackURL: "/", errorCallbackURL: "/login" },
	});
	expect(response.status).toBe(200);
	const { url } = (await response.json()) as { url: string };
	return { authorize: new URL(url), cookie: cookieOf(response) };
}

/** Comes back from the provider with a code. */
async function comeBack(
	courts: Courts,
	client: string,
	authorize: URL,
	cookie: string,
	code: string,
) {
	const query = new URLSearchParams({
		code,
		state: authorize.searchParams.get("state") ?? "",
		iss: OIDC.issuer,
	});
	const response = await courts.fetch(`${origin}/api/auth/callback/oidc?${query}`, {
		headers: { cookie, "cf-connecting-ip": client },
	});
	expect(response.status).toBe(302);
	return {
		location: new URL(response.headers.get("location") ?? "", origin),
		cookie: cookieOf(response),
	};
}

async function sessionOf(courts: Courts, cookie: string) {
	const response = await courts.fetch(`${origin}/api/auth/get-session`, { headers: { cookie } });
	return (await response.json()) as null | {
		session: Record<string, unknown>;
		user: { id: string; email: string; name: string; emailVerified: boolean };
	};
}

/** Whether a cookie from `comeBack` is a working session. */
async function isSignedIn(courts: Courts, cookie: string) {
	return (await sessionOf(courts, cookie)) !== null;
}

interface Person {
	sub: string;
	email: string;
	name?: string;
	sid?: string;
	email_verified?: unknown;
}

/** Someone the provider knows signs in from start to finish. */
async function signIn(courts: Courts, provider: Provider, person: Person, client = newClient()) {
	const { authorize, cookie } = await pressButton(courts, client);
	const code = provider.grant(authorize, {
		name: "Pat Provider",
		email_verified: true,
		...person,
	});
	return comeBack(courts, client, authorize, cookie, code);
}

function userRow(courts: Courts, email: string) {
	return courts.db
		.prepare("SELECT id, name, email_verified FROM user WHERE email = ?")
		.bind(email)
		.first<{ id: string; name: string; email_verified: number }>();
}

function providerAccount(courts: Courts, sub: string) {
	return courts.db
		.prepare("SELECT * FROM account WHERE provider_id = 'oidc' AND account_id = ?")
		.bind(sub)
		.first<Record<string, unknown> & { user_id: string }>();
}

async function sessionIdsOf(courts: Courts, userId: string) {
	const { results } = await courts.db
		.prepare("SELECT oidc_sid FROM session WHERE user_id = ?")
		.bind(userId)
		.all();
	return results.map((row: { oidc_sid: string | null }) => row.oidc_sid);
}

describe("signing in through Gateweave ID", () => {
	let courts: Courts;
	let provider: Provider;

	beforeAll(async () => {
		provider = await standInProvider();
		courts = await startCourts(origin, {
			vars: OIDC_VARS,
			outbound: (request, url) => provider.outbound(request, url),
		});
	});

	afterAll(async () => {
		await courts?.dispose();
	});

	it("makes an account for someone new, with a verified address", async () => {
		const email = "new@oidc.test";
		const { location, cookie } = await signIn(courts, provider, {
			sub: "sub-new",
			email,
			sid: "sid-new",
		});

		expect(location.pathname).toBe("/");
		const session = await sessionOf(courts, cookie);
		expect(session?.user).toMatchObject({ email, name: "Pat Provider", emailVerified: true });
		expect((await providerAccount(courts, "sub-new"))?.user_id).toBe(session?.user.id);
	});

	it("keeps none of the provider's tokens, the first time or the next", async () => {
		const person = { sub: "sub-tokens", email: "tokens@oidc.test" };
		const noTokens = {
			access_token: null,
			refresh_token: null,
			id_token: null,
			access_token_expires_at: null,
			refresh_token_expires_at: null,
		};

		await signIn(courts, provider, person);
		expect(await providerAccount(courts, person.sub)).toMatchObject(noTokens);

		await signIn(courts, provider, person);
		expect(await providerAccount(courts, person.sub)).toMatchObject(noTokens);
	});

	it("signs them in to the same account again, with the provider's new session", async () => {
		const person = { sub: "sub-again", email: "again@oidc.test" };
		const first = await signIn(courts, provider, { ...person, sid: "sid-first" });
		const second = await signIn(courts, provider, { ...person, sid: "sid-second" });

		const firstUser = await sessionOf(courts, first.cookie);
		const secondUser = await sessionOf(courts, second.cookie);
		expect(secondUser?.user.id).toBe(firstUser?.user.id);
		expect(await sessionIdsOf(courts, secondUser?.user.id ?? "")).toEqual(
			expect.arrayContaining(["sid-first", "sid-second"]),
		);
	});

	it("takes the name and email from ID again at the next sign-in", async () => {
		const sub = "sub-renamed";
		await signIn(courts, provider, { sub, email: "old@oidc.test", name: "Old Name" });
		const { cookie } = await signIn(courts, provider, {
			sub,
			email: "new-address@oidc.test",
			name: "New Name",
		});

		expect((await sessionOf(courts, cookie))?.user).toMatchObject({
			name: "New Name",
			email: "new-address@oidc.test",
		});
		expect(await userRow(courts, "old@oidc.test")).toBeNull();
	});

	it("does not tell the browser which of the provider's sessions it came from", async () => {
		const { cookie } = await signIn(courts, provider, {
			sub: "sub-private",
			email: "private@oidc.test",
			sid: "sid-private",
		});
		const session = await sessionOf(courts, cookie);
		expect(session?.session).toBeDefined();
		expect(JSON.stringify(session)).not.toContain("sid-private");
	});

	it("does not let a browser say which of the provider's sessions it came from", async () => {
		const client = newClient();
		const { cookie } = await signIn(
			courts,
			provider,
			{ sub: "sub-claims", email: "claims@oidc.test", sid: "sid-claims" },
			client,
		);

		await authApi(courts, "/update-session", { client, cookie, body: { oidcSid: "sid-other" } });

		const user = await userRow(courts, "claims@oidc.test");
		expect(await sessionIdsOf(courts, user?.id ?? "")).toEqual(["sid-claims"]);
	});

	it("keeps sign-ins running at once apart", async () => {
		const people = Array.from({ length: 8 }, (_, i) => ({
			sub: `sub-at-once-${i}`,
			email: `at-once-${i}@oidc.test`,
			sid: `sid-at-once-${i}`,
		}));
		await Promise.all(people.map((person) => signIn(courts, provider, person)));
		for (const person of people) {
			const user = await userRow(courts, person.email);
			expect(await sessionIdsOf(courts, user?.id ?? "")).toEqual([person.sid]);
		}
	});

	it("falls back on the email for a name the provider does not give", async () => {
		const email = "nameless@oidc.test";
		await signIn(courts, provider, { sub: "sub-nameless", email, name: "" });
		expect((await userRow(courts, email))?.name).toBe(email);
	});

	it("asks the provider for what the ID token leaves out", async () => {
		const client = newClient();
		const email = "userinfo@oidc.test";
		const { authorize, cookie } = await pressButton(courts, client);
		const code = provider.grant(
			authorize,
			{ sub: "sub-userinfo", sid: "sid-userinfo" },
			{ userInfo: { sub: "sub-userinfo", email, email_verified: true, name: "Una Info" } },
		);
		const back = await comeBack(courts, client, authorize, cookie, code);

		const session = await sessionOf(courts, back.cookie);
		expect(session?.user).toMatchObject({ email, name: "Una Info", emailVerified: true });
		expect(await sessionIdsOf(courts, session?.user.id ?? "")).toEqual(["sid-userinfo"]);
	});

	it("leaves the provider alone when someone signs out here", async () => {
		const client = newClient();
		const { cookie } = await signIn(courts, provider, {
			sub: "sub-signs-out",
			email: "signs-out@oidc.test",
		});
		const response = await authApi(courts, "/sign-out", { client, cookie, body: {} });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(await isSignedIn(courts, cookie)).toBe(false);
	});

	describe("an ID token that does not hold up", () => {
		const cases: [string, JWTPayload, "stranger"?][] = [
			["signed with another key", {}, "stranger"],
			["from another issuer", { iss: "https://elsewhere.test" }],
			["for another app", { aud: "another-client" }],
			["for another sign-in", { nonce: "another-nonce" }],
			["with no nonce", { nonce: undefined }],
			["expired", { exp: Math.floor(Date.now() / 1000) - 600 }],
		];

		it.each(cases)("refuses one %s", async (name, claims, signer) => {
			const client = newClient();
			const sub = `sub-${name.replaceAll(" ", "-")}`;
			const email = `${sub}@oidc.test`;
			const { authorize, cookie } = await pressButton(courts, client);
			const code = provider.grant(
				authorize,
				{ sub, email, email_verified: true, ...claims },
				signer ? { key: await provider.strangerKey() } : {},
			);

			const back = await comeBack(courts, client, authorize, cookie, code);

			expect(back.location.pathname).toBe("/login");
			expect(back.location.searchParams.get("error")).toBeTruthy();
			expect(await isSignedIn(courts, back.cookie)).toBe(false);
			expect(await userRow(courts, email)).toBeNull();
		});
	});

	it("refuses a code that came back on someone else's cookie", async () => {
		const client = newClient();
		const email = "stolen-state@oidc.test";
		const { authorize } = await pressButton(courts, client);
		const code = provider.grant(authorize, { sub: "sub-stolen", email, email_verified: true });
		const other = await pressButton(courts, client);

		const back = await comeBack(courts, client, authorize, other.cookie, code);

		expect(back.location.searchParams.get("error")).toBeTruthy();
		expect(await isSignedIn(courts, back.cookie)).toBe(false);
		expect(await userRow(courts, email)).toBeNull();
	});
});

describe("Gateweave ID not answering", () => {
	it("costs nothing but its own button, which works once it is back", async () => {
		const provider = await standInProvider();
		provider.go("down");
		const courts = await startCourts(origin, {
			vars: OIDC_VARS,
			outbound: (request, url) => provider.outbound(request, url),
		});
		try {
			expect((await courts.fetch(`${origin}/`)).status).toBe(200);
			expect((await courts.fetch(`${origin}/login`)).status).toBe(200);
			expect(await sessionOf(courts, "")).toBeNull();
			// None of that asked it anything.
			expect(provider.requests).toEqual([]);

			const pressed = await authApi(courts, "/sign-in/social", {
				client: newClient(),
				body: { provider: "oidc", callbackURL: "/" },
			});
			expect(pressed.status).toBe(404);
			expect(await pressed.json()).toMatchObject({ code: "PROVIDER_NOT_FOUND" });
			expect(provider.requests).toEqual(["/.well-known/openid-configuration"]);

			provider.go("up");
			const back = await signIn(courts, provider, {
				sub: "sub-back-up",
				email: "back-up@oidc.test",
			});
			expect(await isSignedIn(courts, back.cookie)).toBe(true);
		} finally {
			await courts.dispose();
		}
	});

	it("offers nothing when the provider has no keys to check its tokens with", async () => {
		const provider = await standInProvider();
		provider.go("no-keys");
		const courts = await startCourts(origin, {
			vars: OIDC_VARS,
			outbound: (request, url) => provider.outbound(request, url),
		});
		try {
			const pressed = await authApi(courts, "/sign-in/social", {
				client: newClient(),
				body: { provider: "oidc", callbackURL: "/" },
			});
			expect(pressed.status).toBe(404);
		} finally {
			await courts.dispose();
		}
	});

	it("keeps someone waiting at most 10 seconds, and nobody else at all", async () => {
		const provider = await standInProvider();
		provider.go("hanging");
		const courts = await startCourts(origin, {
			vars: OIDC_VARS,
			outbound: (request, url) => provider.outbound(request, url),
		});
		try {
			const started = Date.now();
			const waiting = authApi(courts, "/sign-in/social", {
				client: newClient(),
				body: { provider: "oidc", callbackURL: "/" },
			});
			await vi.waitFor(() => expect(provider.requests).not.toEqual([]));

			expect((await courts.fetch(`${origin}/`)).status).toBe(200);
			expect(await sessionOf(courts, "")).toBeNull();
			expect(Date.now() - started).toBeLessThan(9_000);

			const pressed = await waiting;
			expect(pressed.status).toBe(404);
			expect(Date.now() - started).toBeLessThan(15_000);
		} finally {
			await courts.dispose();
		}
	});
});

describe("Gateweave ID stopping waiting for the answer to a logout", () => {
	it("still ends the session", async () => {
		const provider = await standInProvider();
		let slowKeys = false;
		const courts = await startCourts(origin, {
			isolates: 2,
			vars: OIDC_VARS,
			outbound: async (request, url) => {
				if (slowKeys && url.pathname === "/jwks") {
					await new Promise((resolve) => setTimeout(resolve, 1500));
				}
				return provider.outbound(request, url);
			},
		});
		try {
			const person = { sub: "sub-impatient", email: "impatient@oidc.test", sid: "sid-impatient" };
			const { cookie } = await signIn(courts, provider, person);
			const token = await provider.logoutToken({ sub: person.sub, sid: person.sid });

			// The other isolate has never seen a sign-in, so it has the provider's keys to fetch.
			slowKeys = true;
			const answer = await courts.fetchAndStopWaiting(
				`${origin}/api/auth/backchannel-logout/oidc`,
				{
					method: "POST",
					headers: {
						"content-type": "application/x-www-form-urlencoded",
						"cf-connecting-ip": newClient(),
					},
					body: new URLSearchParams({ logout_token: token }).toString(),
				},
			);
			expect(answer.status).toBe(504);

			await expect
				.poll(() => isSignedIn(courts, cookie), { timeout: 10_000, interval: 250 })
				.toBe(false);
		} finally {
			await courts.dispose();
		}
	});
});

describe("a logout that cannot be checked for now", () => {
	// To the isolate that has never seen a sign-in, so it has the provider's keys to fetch.
	const deliver = (courts: Courts, token: string) =>
		courts.fetchIn(1, `${origin}/api/auth/backchannel-logout/oidc`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"cf-connecting-ip": newClient(),
			},
			body: new URLSearchParams({ logout_token: token }).toString(),
		});

	const failing = () => new Response("Down", { status: 500 });
	const cases: [string, string, () => Response | Promise<Response>][] = [
		["the keys answer with an error", "/jwks", failing],
		["the keys make no sense", "/jwks", () => Response.json({})],
		["the keys do not answer", "/jwks", () => new Promise<Response>(() => {})],
		["discovery has not worked", "/.well-known/openid-configuration", failing],
	];

	it("asks for another try when fetching the keys fails, and ends nothing", async () => {
		const provider = await standInProvider();
		let nowhere = false;
		const courts = await startCourts(origin, {
			isolates: 2,
			vars: OIDC_VARS,
			outbound: async (request, url) => {
				const answer = await provider.outbound(request, url);
				if (!nowhere || !answer || !url.pathname.startsWith("/.well-known/")) return answer;
				// A fetch that rejects, as one does when the network fails. A stand-in cannot do that by
				// throwing, which Miniflare turns into a 500, but no Worker can fetch this address.
				const document = (await answer.json()) as object;
				return Response.json({ ...document, jwks_uri: "ftp://provider.test/jwks" });
			},
		});
		try {
			const person = { sub: "sub-nowhere", email: "nowhere@oidc.test", sid: "sid-nowhere" };
			const { cookie } = await signIn(courts, provider, person);
			const token = await provider.logoutToken({ sub: person.sub, sid: person.sid });

			nowhere = true;
			expect((await deliver(courts, token)).status).toBe(503);
			expect(await isSignedIn(courts, cookie)).toBe(true);
		} finally {
			await courts.dispose();
		}
	});

	it.each(cases)("asks for another try when %s, and ends nothing", async (_name, path, down) => {
		const provider = await standInProvider();
		let isDown = false;
		const courts = await startCourts(origin, {
			isolates: 2,
			vars: OIDC_VARS,
			outbound: async (request, url) => {
				if (isDown && url.pathname === path) return down();
				return provider.outbound(request, url);
			},
		});
		try {
			const person = { sub: "sub-unchecked", email: "unchecked@oidc.test", sid: "sid-unchecked" };
			const { cookie } = await signIn(courts, provider, person);
			const token = await provider.logoutToken({ sub: person.sub, sid: person.sid });

			isDown = true;
			const answer = await deliver(courts, token);
			expect(answer.status).toBe(503);
			expect(await answer.json()).toEqual({ error: "temporarily_unavailable" });
			expect(await isSignedIn(courts, cookie)).toBe(true);

			isDown = false;
			expect((await deliver(courts, token)).status).toBe(200);
			expect(await isSignedIn(courts, cookie)).toBe(false);
		} finally {
			await courts.dispose();
		}
	});
});

describe("signing out at Gateweave ID", () => {
	let courts: Courts;
	let provider: Provider;

	beforeAll(async () => {
		provider = await standInProvider();
		courts = await startCourts(origin, {
			isolates: 2,
			vars: OIDC_VARS,
			outbound: (request, url) => provider.outbound(request, url),
		});
	});

	afterAll(async () => {
		await courts?.dispose();
	});

	/** The provider delivers a logout token. No cookie and no Origin: it is not a browser. */
	function deliver(token: string | undefined, { isolate = 0, id = "oidc" } = {}) {
		return courts.fetchIn(isolate, `${origin}/api/auth/backchannel-logout/${id}`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"cf-connecting-ip": newClient(),
			},
			body: new URLSearchParams(token === undefined ? {} : { logout_token: token }).toString(),
		});
	}

	it("ends the session a token names, and no other of theirs", async () => {
		const person = { sub: "sub-by-sid", email: "by-sid@oidc.test" };
		const ended = await signIn(courts, provider, { ...person, sid: "sid-ended" });
		const kept = await signIn(courts, provider, { ...person, sid: "sid-kept" });

		const response = await deliver(
			await provider.logoutToken({ sub: person.sub, sid: "sid-ended" }),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await isSignedIn(courts, ended.cookie)).toBe(false);
		expect(await isSignedIn(courts, kept.cookie)).toBe(true);
	});

	it("ends a session while a Worker on another zone sends junk to the same place", async () => {
		// Every Worker reaches another zone from this one address, whoever runs it (Track's TRK-92).
		const fromWorker = (zone: string, body: string) =>
			courts.fetchIn(0, `${origin}/api/auth/backchannel-logout/oidc`, {
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					"cf-connecting-ip": "2a06:98c0:3600::103",
					"cf-worker": zone,
				},
				body,
			});
		const statuses = new Set<number>();
		const someJunk = async (size: number) => {
			const answers = await Promise.all(
				Array.from({ length: size }, () => fromWorker("junk.example", "logout_token=junk")),
			);
			for (const answer of answers) statuses.add(answer.status);
		};
		const person = { sub: "sub-junk", email: "junk@oidc.test" };
		const session = await signIn(courts, provider, { ...person, sid: "sid-junk" });
		const token = await provider.logoutToken({ sub: person.sub, sid: "sid-junk" });

		// The limit gives one back every tenth of a second, so the delivery has to come during the junk.
		for (let sent = 0; sent < 110; sent += 5) await someJunk(5);
		let delivered = false;
		const junk = (async () => {
			while (!delivered) await someJunk(2);
		})();
		const response = await fromWorker(
			"provider.example",
			new URLSearchParams({ logout_token: token ?? "" }).toString(),
		).finally(() => {
			delivered = true;
		});
		await junk;

		expect(statuses).toContain(429);
		expect(response.status).toBe(200);
		expect(await isSignedIn(courts, session.cookie)).toBe(false);
	});

	it("finds a session by its id alone, when that is all a token says", async () => {
		const { cookie } = await signIn(courts, provider, {
			sub: "sub-sid-only",
			email: "sid-only@oidc.test",
			sid: "sid-only",
		});

		expect((await deliver(await provider.logoutToken({ sid: "sid-only" }))).status).toBe(200);

		expect(await isSignedIn(courts, cookie)).toBe(false);
	});

	it("does not end someone's session for a token about somebody else", async () => {
		const { cookie } = await signIn(courts, provider, {
			sub: "sub-bystander",
			email: "bystander@oidc.test",
			sid: "sid-bystander",
		});
		await signIn(courts, provider, {
			sub: "sub-other",
			email: "other@oidc.test",
			sid: "sid-other",
		});

		const response = await deliver(
			await provider.logoutToken({ sub: "sub-other", sid: "sid-bystander" }),
		);

		expect(response.status).toBe(200);
		expect(await isSignedIn(courts, cookie)).toBe(true);
	});

	it("ends all of someone's sessions when a token names only them", async () => {
		const person = { sub: "sub-by-sub", email: "by-sub@oidc.test" };
		const first = await signIn(courts, provider, { ...person, sid: "sid-sub-1" });
		const second = await signIn(courts, provider, { ...person, sid: "sid-sub-2" });
		const bystander = await signIn(courts, provider, {
			sub: "sub-next-door",
			email: "next-door@oidc.test",
			sid: "sid-next-door",
		});

		expect((await deliver(await provider.logoutToken({ sub: person.sub }))).status).toBe(200);

		expect(await isSignedIn(courts, first.cookie)).toBe(false);
		expect(await isSignedIn(courts, second.cookie)).toBe(false);
		expect(await isSignedIn(courts, bystander.cookie)).toBe(true);
	});

	it("answers 200 about someone it does not know, and ends nothing", async () => {
		const { cookie } = await signIn(courts, provider, {
			sub: "sub-known",
			email: "known@oidc.test",
			sid: "sid-known",
		});

		const response = await deliver(
			await provider.logoutToken({ sub: "sub-nobody", sid: "sid-known" }),
		);

		expect(response.status).toBe(200);
		expect(await isSignedIn(courts, cookie)).toBe(true);
	});

	it("works in an isolate that has never seen a sign-in", async () => {
		const { cookie } = await signIn(courts, provider, {
			sub: "sub-cold",
			email: "cold@oidc.test",
			sid: "sid-cold",
		});

		const response = await deliver(
			await provider.logoutToken({ sub: "sub-cold", sid: "sid-cold" }),
			{ isolate: 1 },
		);

		expect(response.status).toBe(200);
		expect(await isSignedIn(courts, cookie)).toBe(false);
	});

	it("takes a token that leaves out its type", async () => {
		const { cookie } = await signIn(courts, provider, {
			sub: "sub-no-typ",
			email: "no-typ@oidc.test",
			sid: "sid-no-typ",
		});
		const token = await provider.logoutToken({ sid: "sid-no-typ" }, { typ: "" });

		expect((await deliver(token)).status).toBe(200);
		expect(await isSignedIn(courts, cookie)).toBe(false);
	});

	describe("a token that does not hold up", () => {
		const now = () => Math.floor(Date.now() / 1000);
		const victim = { sub: "sub-victim", email: "victim@oidc.test", sid: "sid-victim" };
		const named = { sub: victim.sub, sid: victim.sid };
		let victimCookie: string;

		beforeAll(async () => {
			victimCookie = (await signIn(courts, provider, victim)).cookie;
		});

		const cases: [string, () => Promise<string>][] = [
			[
				"signed with another key",
				async () => provider.logoutToken(named, { key: await provider.strangerKey() }),
			],
			["from another issuer", () => provider.logoutToken({ ...named, iss: "https://x.test" })],
			["for another app", () => provider.logoutToken({ ...named, aud: "another-client" })],
			["of another type", () => provider.logoutToken(named, { typ: "JWT" })],
			["with no event", () => provider.logoutToken({ ...named, events: undefined })],
			[
				"with another event",
				() => provider.logoutToken({ ...named, events: { "https://x.test/event": {} } }),
			],
			["with a nonce", () => provider.logoutToken({ ...named, nonce: "a-nonce" })],
			["naming nobody", () => provider.logoutToken({})],
			["expired", () => provider.logoutToken({ ...named, exp: now() - 600, iat: now() - 900 })],
			["made long ago", () => provider.logoutToken({ ...named, iat: now() - 3600 })],
			["with no date", () => provider.logoutToken({ ...named, iat: undefined })],
			["with no expiry", () => provider.logoutToken({ ...named, exp: undefined })],
			[
				"that is really an ID token",
				() =>
					provider.sign({
						iss: OIDC.issuer,
						aud: OIDC.clientId,
						iat: now(),
						exp: now() + 60,
						nonce: "a-nonce",
						...named,
					}),
			],
			[
				"not signed at all",
				async () => {
					const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
					return `${part({ alg: "none", typ: "logout+jwt" })}.${part({
						iss: OIDC.issuer,
						aud: OIDC.clientId,
						iat: now(),
						exp: now() + 60,
						events: { [LOGOUT_EVENT]: {} },
						...named,
					})}.`;
				},
			],
			["that is no token", async () => "not-a-token"],
		];

		it.each(cases)("refuses one %s", async (_name, make) => {
			const response = await deliver(await make());

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: "invalid_request" });
			expect(response.headers.get("cache-control")).toBe("no-store");
			expect(await isSignedIn(courts, victimCookie)).toBe(true);
		});

		it("refuses a request with no token", async () => {
			expect((await deliver(undefined)).status).toBe(400);
		});

		it("refuses another provider's address", async () => {
			const token = await provider.logoutToken(named);
			expect((await deliver(token, { id: "github" })).status).toBe(404);
			expect(await isSignedIn(courts, victimCookie)).toBe(true);
		});

		it("takes only the form a provider sends", async () => {
			const response = await courts.fetch(`${origin}/api/auth/backchannel-logout/oidc`, {
				method: "POST",
				headers: { "content-type": "application/json", "cf-connecting-ip": newClient() },
				body: JSON.stringify({ logout_token: await provider.logoutToken(named) }),
			});
			expect(response.status).toBe(415);
			expect(await isSignedIn(courts, victimCookie)).toBe(true);
		});
	});
});

describe("the sign-in page", () => {
	let courts: Courts;
	let provider: Provider;

	const { OIDC_PROVIDER_NAME: _name, ...unnamed } = OIDC_VARS;
	const { OIDC_CLIENT_SECRET: _secret, ...incomplete } = OIDC_VARS;

	beforeAll(async () => {
		provider = await standInProvider();
		courts = await startCourts(origin, {
			isolates: 4,
			isolateVars: [{}, OIDC_VARS, unnamed, incomplete],
			outbound: (request, url) => provider.outbound(request, url),
		});
	});

	afterAll(async () => {
		await courts?.dispose();
	});

	async function page(isolate: number, query = "") {
		const response = await courts.fetchIn(isolate, `${origin}/login${query}`);
		expect(response.status).toBe(200);
		return response.text();
	}

	it("says signing in is not set up without a provider", async () => {
		expect(await page(0)).toContain("isn’t set up");
	});

	it("calls the provider what the settings say", async () => {
		expect(await page(1)).toContain("One Gateweave ID account signs you in here.");
	});

	it("has a name for a provider that was not given one", async () => {
		expect(await page(2)).toContain("One Gateweave ID account signs you in here.");
	});

	it("says signing in is not set up with part of the settings", async () => {
		expect(await page(3)).toContain("isn’t set up");
	});

	it("does not offer the provider's way in without a provider", async () => {
		const response = await courts.fetchIn(0, `${origin}/api/auth/sign-in/social`, {
			method: "POST",
			headers: { origin, "content-type": "application/json", "cf-connecting-ip": newClient() },
			body: JSON.stringify({ provider: "oidc", callbackURL: "/" }),
		});
		expect(response.status).toBe(404);
		const logout = await courts.fetchIn(0, `${origin}/api/auth/backchannel-logout/oidc`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: "logout_token=x",
		});
		expect(logout.status).toBe(404);
		expect(provider.requests).toEqual([]);
	});

	it("has no password to sign in or sign up with", async () => {
		for (const path of ["/sign-in/email", "/sign-up/email"]) {
			const response = await authApi(courts, path, {
				client: newClient(),
				body: { name: "Sam", email: "sam@oidc.test", password: "a-long-test-password" },
			});
			expect(response.status).toBeGreaterThanOrEqual(400);
		}
		expect(await page(1)).not.toContain('type="password"');
	});

	it("explains a refusal in its own words", async () => {
		expect(await page(1, "?error=access_denied")).toContain("You chose not to sign in.");
		const made = await page(1, `?error=${encodeURIComponent("Call this number")}`);
		// What the page says, since the router also carries its query along in a script.
		const said = /role="alert"[^>]*>([^<]*)</.exec(made)?.[1];
		expect(said).toContain("did not work");
		expect(said).not.toContain("Call this number");
	});
});
