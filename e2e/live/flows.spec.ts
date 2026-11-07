// What courts and Gateweave ID do together, live: sign-in, bookings, what courts keeps, Hallmark on the signed-in
// pages, and both ways of signing out. One at a time, in this order: the sign-outs end what the tests before them use.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { COURTS, ID, inCourts, open, people, signedIn, stateOf } from "./target";

test.describe.configure({ mode: "serial" });

let a: Page;
let b: Page;
test.beforeAll(async ({ browser }) => {
	a = await (await browser.newContext({ storageState: stateOf("a") })).newPage();
	b = await (await browser.newContext({ storageState: stateOf("b") })).newPage();
});
test.afterAll(async () => {
	await a?.context().close();
	await b?.context().close();
});

const HOUR = "17:00";
/** Picks the booker's last day and HOUR, and says which court it offers, from the button's words. */
async function pick(page: Page) {
	await page.locator('label[for^="d-"]').last().click();
	await page.locator(`label[for="t-${HOUR}"]`).click();
	const button = page.locator(".booker .btn");
	await expect(button).toContainText(`at ${HOUR}`);
	return ((await button.textContent()) ?? "").replace("Book ", "").replace(` at ${HOUR}`, "");
}
const courtRow = (page: Page, court: string) =>
	page.locator(".courts label", { hasText: new RegExp(`^${court}`, "i") });

test("both are signed in to courts through Gateweave ID", async () => {
	for (const page of [a, b]) {
		await open(page, "/bookings");
		await expect(page.locator(".mine__head")).toContainText("through Gateweave ID");
	}
});

test("courts keeps none of Gateweave ID's tokens", () => {
	const { a: pa, b: pb } = people();
	const rows = inCourts(
		`SELECT access_token, refresh_token, id_token FROM account WHERE user_id IN (SELECT id FROM user WHERE email IN ('${pa.email}', '${pb.email}'))`,
	);
	expect(rows).toHaveLength(2);
	for (const row of rows)
		expect(row).toEqual({ access_token: null, refresh_token: null, id_token: null });
});

/** Where A's signed-in pages are saved for Hallmark's lint. Inside the git-ignored build folder. */
const SAVED = "dist/hallmark-signed-in";
/**
 * Saves `page` as it is now, signed in, as `name`.html: its HTML without scripts (the lint needs the rendered page, not
 * the app), and every stylesheet, font and image it names from the live site, at the same paths, so the lint renders
 * exactly what was deployed. Returns the page's path.
 */
async function savePage(page: Page, name: string) {
	const fetched = new Set<string>();
	async function keep(path: string) {
		if (fetched.has(path)) return;
		fetched.add(path);
		const answer = await page.context().request.get(`${COURTS}${path}`);
		expect(answer.ok(), `fetching ${path} for Hallmark's lint`).toBe(true);
		const file = join(SAVED, path);
		mkdirSync(dirname(file), { recursive: true });
		const body = await answer.body();
		if (path.endsWith(".css")) {
			for (const [, url] of body.toString("utf8").matchAll(/url\((\/[^)"']+)\)/g)) {
				if (url) await keep(url);
			}
		}
		writeFileSync(file, body);
	}
	const html = (await page.content())
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
		.replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, "");
	for (const [, , path] of html.matchAll(
		/(href|src)="(\/(?!\/)[^"]+\.(?:css|svg|jpg|jpeg|png|webp|avif|woff2?))"/g,
	)) {
		if (path) await keep(path);
	}
	writeFileSync(join(SAVED, `${name}.html`), html);
	return `/${name}.html`;
}
const saved: { page?: string; app?: string } = {};

test("a double booking is refused, and a cancel frees the court", async () => {
	await open(a, "/");
	const court = await pick(a);
	await open(b, "/");
	expect(await pick(b), "both are offered the same court").toBe(court);

	await a.locator(".booker .btn").click();
	await expect(a.locator(".booker__msg")).toContainText(`Booked: ${court}`);
	await b.locator(".booker .btn").click();
	await expect(b.locator(".booker__msg")).toContainText("Someone took");
	await open(b, "/");
	await pick(b);
	await expect(courtRow(b, court)).toContainText("taken");

	// A's pages, signed in and with a booking on them, for Hallmark's lint below.
	rmSync(SAVED, { recursive: true, force: true });
	await open(a, "/");
	saved.page = await savePage(a, "home");
	await open(a, "/bookings");
	await expect(a.locator(".mine__table tbody tr").first()).toBeVisible();
	saved.app = await savePage(a, "bookings");

	await a.getByRole("button", { name: "Cancel" }).first().click();
	await expect(a.locator(".mine__empty")).toBeVisible();
	await open(b, "/");
	await pick(b);
	await expect(courtRow(b, court)).not.toContainText("taken");
});

test("the signed-in pages pass Hallmark's lint, as deployed", async () => {
	// Known: Your bookings scrolls sideways at 320px, and the ID account link wraps (issue #4). Playwright reports this as
	// an expected failure until then, and fails it once it passes, so this line goes with the fix.
	test.fail(true, "issue #4: Your bookings at 320px");
	// Over HTTP, as e2e/hallmark.spec.ts does: given a file, the lint would also read the saved built CSS as source.
	const types: Record<string, string> = {
		html: "text/html",
		css: "text/css",
		svg: "image/svg+xml",
		jpg: "image/jpeg",
		woff2: "font/woff2",
	};
	const server: Server = createServer((request, response) => {
		const path = join(
			SAVED,
			normalize(decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname)),
		);
		if (!path.startsWith(`${SAVED}/`) || !existsSync(path)) return response.writeHead(404).end();
		response.writeHead(200, {
			"content-type": types[extname(path).slice(1)] ?? "application/octet-stream",
		});
		response.end(readFileSync(path));
	});
	await new Promise<void>((listening) => server.listen(0, "127.0.0.1", listening));
	const address = server.address();
	const port = typeof address === "object" && address ? address.port : 0;
	try {
		// The home page is a page; Your bookings is an app screen (Hallmark's references/flow.md).
		for (const [scope, path] of [
			["page", saved.page],
			["app", saved.app],
		] as const) {
			const output = await new Promise<string>((done) => {
				const child = spawn("node", [
					".claude/skills/hallmark/scripts/sloplint.mjs",
					"src/styles.css",
					"src/styles",
					"--url",
					`http://127.0.0.1:${port}${path}`,
					"--render",
					"--genre",
					"editorial",
					"--scope",
					scope,
				]);
				let out = "";
				child.stdout.on("data", (chunk) => {
					out += chunk;
				});
				child.stderr.on("data", (chunk) => {
					out += chunk;
				});
				child.on("close", (code) => done(`${out}\n(sloplint exited ${code})`));
			});
			expect(output, `Hallmark, signed in, --scope ${scope}:\n${output}`).toMatch(
				/clean\. 0 FAIL, 0 REFLEX, 0 WARN[\s\S]*\(sloplint exited 0\)$/,
			);
		}
	} finally {
		server.close();
	}
});

test("courts takes the name from Gateweave ID again at the next sign-in", async () => {
	const renamed = `E2E Renamed ${Date.now()}`;
	// As ID's own account page does (authClient.updateUser, src/components/account-profile.tsx in ID).
	const answer = await a.context().request.post(`${ID}/api/auth/update-user`, {
		headers: { origin: ID },
		data: { name: renamed },
	});
	expect(answer.ok(), `ID refused the new name: ${await answer.text()}`).toBe(true);

	await open(a, "/");
	await a.locator(".nav").getByRole("button", { name: "Sign out" }).click();
	await a.locator(".nav").getByRole("button", { name: "Sign in" }).click();
	await expect(a.getByRole("link", { name: "Your bookings" })).toBeVisible();
	await open(a, "/bookings");
	await expect(a.locator(".mine__head")).toContainText(`Signed in as ${renamed}`);
});

test("courts' Sign out signs out of courts, and leaves Gateweave ID signed in", async () => {
	await open(a, "/");
	await a.locator(".nav").getByRole("button", { name: "Sign out" }).click();
	await expect(a.locator(".nav").getByRole("button", { name: "Sign in" })).toBeVisible();
	expect(await signedIn(a, COURTS), "signed in to courts").toBe(false);
	expect(await signedIn(a, ID), "signed in at ID").toBe(true);
	expect(await signedIn(b, COURTS), "B, still signed in to courts").toBe(true);
});

test("signing out at Gateweave ID ends the courts session too (back-channel logout)", async () => {
	// As on ID's account page.
	const out = await b.context().request.post(`${ID}/api/auth/sign-out`, {
		headers: { origin: ID },
		data: {},
	});
	expect(out.ok(), `ID refused the sign-out: ${await out.text()}`).toBe(true);
	expect(await signedIn(b, ID), "signed in at ID").toBe(false);
	// ID's Worker posts to courts' /api/auth/backchannel-logout/oidc, retrying from a queue.
	await expect
		.poll(() => signedIn(b, COURTS), { message: "still signed in to courts" })
		.toBe(false);
});
