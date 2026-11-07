// mise run all:e2e: the live courts site and the live Gateweave ID, end to end, in Chrome, with no human (issue #3).
// It is the only test of signing in, booking and signing out through the real ID; the Worker tests in test/app/ hold
// the app's side against a stand-in.
//
//   1. Two throwaway people are made at ID through ID's own invitation route: an invitation row for a made-up address,
//      holding only the SHA-256 of a random token, as ID's own "invite" writes it (ID's docs/architecture.md, "An
//      invitation from the owner is a link": the owner "could write the row themselves"). Accepting it in the test's
//      browser, with a random password that exists only in this run's memory, makes the account and signs that browser
//      in at ID. No email is sent, and Turnstile doesn't stand in front of invitations.
//   2. Each signs in to courts with the header's "Sign in": to ID, where they are signed in already, and straight back.
//   3. A and B pick the same hour; A books it, and B's booking of it is refused. B sees it taken. A cancels it, and B
//      sees it free.
//   4. A presses courts' "Sign out": signed out of courts, still signed in at ID, as Track does. (Signing out of both
//      in one go waits on two problems in Gateweave ID, seen on v0.10.4 and still in v0.10.6, issue #3.)
//   5. B signs out at ID, as on ID's account page: ID's back-channel logout ends B's session in courts.
//   6. Hallmark's lint on A's signed-in pages, the home page and Your bookings with a booking on it, as deployed.
//   7. Both people are deleted from ID and from courts, whatever happened.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";
import { APP_DOMAIN } from "./app-config.mjs";
import { APP_WRANGLER } from "./cloudflare.mjs";
import { fetchId, ID_DOMAIN, idWrangler } from "./id-release.mjs";

execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });
fetchId();

const COURTS = `https://${APP_DOMAIN}`;
const ID = `https://${ID_DOMAIN}`;
const WAIT = 30_000;

/** One SQL statement on ID's D1, answered as rows. */
function inId(sql) {
	const out = idWrangler(["d1", "execute", "DB", "--remote", "--json", "--command", sql], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	return JSON.parse(out)[0].results;
}

/** One SQL statement on this app's D1, answered as rows. */
function inCourts(sql) {
	const run = spawnSync(
		"node",
		[APP_WRANGLER, "d1", "execute", "DB", "--remote", "--json", "--command", sql],
		{ encoding: "utf8" },
	);
	if (run.status !== 0) throw new Error(`courts' D1 refused: ${run.stderr}`);
	return JSON.parse(run.stdout)[0].results;
}

/** A made-up person: an address at example.com, which is never anyone's, and a password for this run only. */
function person(letter) {
	return {
		name: `E2E Player ${letter}`,
		email: `e2e-${letter.toLowerCase()}-${randomUUID()}@example.com`,
		password: randomBytes(24).toString("base64url"),
		token: randomBytes(32).toString("base64url"),
	};
}

const people = [person("A"), person("B")];
const addresses = people.map(({ email }) => `'${email}'`).join(", ");

/** Waits until `locator` shows `text`, or fails saying what it was waiting for. */
async function see(locator, text, what) {
	try {
		await locator.filter({ hasText: text }).first().waitFor({ timeout: WAIT });
	} catch {
		throw new Error(
			`Never saw ${what} (expected "${text}", page shows "${await locator.first().textContent()}")`,
		);
	}
}

/** Opens a page and waits until React has hydrated it (the root sets data-hydrated). */
async function open(page, path) {
	await page.goto(`${COURTS}${path}`);
	await page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: WAIT });
}

/** Picks the booker's last day and `hour`: the court it offers, from the button's words. */
async function pick(page, hour) {
	await page.locator('label[for^="d-"]').last().click();
	await page.locator(`label[for="t-${hour}"]`).click();
	const button = page.locator(".booker .btn");
	await see(button, `at ${hour}`, `the booker at ${hour}`);
	return (await button.textContent())?.replace("Book ", "").replace(` at ${hour}`, "") ?? "";
}

/** Where the signed-in pages are saved for Hallmark's lint. Inside the git-ignored build folder. */
const SAVED = "dist/hallmark-signed-in";
const LINT_PORT = 4714;
let server;

/**
 * Saves `page` as it is now, signed in, as `name`.html for Hallmark's lint: its HTML without scripts (the lint needs
 * the rendered page, not the app), and every stylesheet, font and image it names from the live site, fetched through
 * this browser and stored at the same paths, so the lint, given them over HTTP (step 6), renders exactly what was
 * deployed. Returns the page's path.
 */
async function savePage(context, page, name) {
	const fetched = new Set();
	async function keep(path) {
		if (fetched.has(path)) return;
		fetched.add(path);
		const answer = await context.request.get(`${COURTS}${path}`);
		if (!answer.ok())
			throw new Error(`Couldn't fetch ${path} for Hallmark's lint (${answer.status()})`);
		const file = join(SAVED, path);
		mkdirSync(dirname(file), { recursive: true });
		const body = await answer.body();
		if (path.endsWith(".css")) {
			for (const [, url] of body.toString("utf8").matchAll(/url\((\/[^)"']+)\)/g)) await keep(url);
		}
		writeFileSync(file, body);
	}
	const html = (await page.content())
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
		.replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, "");
	for (const [, , path] of html.matchAll(
		/(href|src)="(\/(?!\/)[^"]+\.(?:css|svg|jpg|jpeg|png|webp|avif|woff2?))"/g,
	)) {
		await keep(path);
	}
	writeFileSync(join(SAVED, `${name}.html`), html);
	return `/${name}.html`;
}

/** Whether a browser is signed in at `origin`, by Better Auth's own session check there. */
async function signedIn(context, origin) {
	const answer = await context.request.get(`${origin}/api/auth/get-session`);
	return (await answer.json()) !== null;
}

let browser;
let failed = false;
/** Each person's page, and every address it went to, for saying where a failed run got stuck. */
const watched = [];
try {
	console.log("\n1. Two throwaway people, invited into Gateweave ID.");
	const [owner] = inId("SELECT owner_id AS id FROM deployment WHERE id = 1");
	if (!owner?.id) throw new Error("Gateweave ID has no owner: run mise run id:claim first");
	const now = Date.now();
	for (const each of people) {
		const hash = createHash("sha256").update(each.token).digest("base64url");
		inId(
			`INSERT INTO deployment_invitation (id, email, token_hash, invited_by, expires_at, created_at) VALUES ('${randomBytes(16).toString("hex")}', '${each.email}', '${hash}', '${owner.id}', ${now + 3_600_000}, ${now})`,
		);
	}

	// Chrome goes through the proxy when there is one (a Claude cloud session, whose Chrome trusts it); on a Mac, none.
	const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
	browser = await chromium.launch({ channel: "chrome", proxy });
	const [a, b] = await Promise.all(
		people.map(async (each) => {
			const context = await browser.newContext();
			const accepted = await context.request.post(`${ID}/api/auth/deployment/invitations/accept`, {
				headers: { origin: ID },
				data: { token: each.token, name: each.name, newPassword: each.password },
			});
			if (!accepted.ok()) {
				throw new Error(
					`ID refused the invitation (${accepted.status()}): ${await accepted.text()}`,
				);
			}
			const page = await context.newPage();
			const went = [];
			const refused = [];
			page.on("framenavigated", (frame) => {
				if (frame === page.mainFrame()) went.push(frame.url());
			});
			// What the browser refused, such as a page's Content Security Policy blocking a form or a redirect.
			page.on("console", (message) => {
				if (message.type() === "error") refused.push(message.text());
			});
			watched.push({ name: each.name, context, page, went, refused });
			return { ...each, context, page };
		}),
	);
	console.log(`   ${a.email} and ${b.email} are signed in at ID.`);

	console.log("\n2. Each signs in to courts with the header's Sign in, through ID.");
	for (const each of [a, b]) {
		await open(each.page, "/");
		await each.page.locator(".nav").getByRole("button", { name: "Sign in" }).click();
		// Only there after the round trip: to ID, where they are signed in, and back with a session here.
		await each.page.getByRole("link", { name: "Your bookings" }).waitFor({ timeout: WAIT });
		console.log(`   ${each.name} is signed in to courts.`);
	}

	console.log("\n3. The same hour for both: A books it, and B's booking is refused.");
	const hour = "17:00";
	const court = await pick(a.page, hour);
	await open(b.page, "/");
	const sameCourt = await pick(b.page, hour);
	if (sameCourt !== court) throw new Error(`A was offered ${court} and B ${sameCourt}`);
	await a.page.locator(".booker .btn").click();
	await see(a.page.locator(".booker__msg"), `Booked: ${court}`, "A's booking");
	console.log(`   A booked ${court} at ${hour}.`);
	await b.page.locator(".booker .btn").click();
	await see(b.page.locator(".booker__msg"), "Someone took", "B's booking refused");
	console.log("   B's booking of it was refused.");
	await open(b.page, "/");
	await pick(b.page, hour);
	const row = () => b.page.locator(".courts label", { hasText: new RegExp(`^${court}`, "i") });
	await see(row(), "taken", "the court shown taken to B");
	console.log("   B sees it taken.");

	// A's pages, signed in and with a booking on them, saved for Hallmark's lint (step 6).
	rmSync(SAVED, { recursive: true, force: true });
	mkdirSync(SAVED, { recursive: true });
	await open(a.page, "/");
	const home = await savePage(a.context, a.page, "home");
	await open(a.page, "/bookings");
	await a.page.locator(".mine__table tbody tr").first().waitFor({ timeout: WAIT });
	const bookings = await savePage(a.context, a.page, "bookings");

	await open(a.page, "/bookings");
	await a.page.getByRole("button", { name: "Cancel" }).first().click();
	await a.page.locator(".mine__empty").waitFor({ timeout: WAIT });
	await open(b.page, "/");
	await pick(b.page, hour);
	if ((await row().textContent())?.includes("taken"))
		throw new Error("A cancelled, but B still sees it taken");
	console.log("   A cancelled it, and B sees it free.");

	console.log(
		"\n4. A presses Sign out in courts: out of courts, still signed in at ID, as Track does.",
	);
	await open(a.page, "/");
	await a.page.locator(".nav").getByRole("button", { name: "Sign out" }).click();
	// The page comes back fresh, signed out.
	await a.page.locator(".nav").getByRole("button", { name: "Sign in" }).waitFor({ timeout: WAIT });
	if (await signedIn(a.context, COURTS)) throw new Error("A is still signed in to courts");
	if (!(await signedIn(a.context, ID))) throw new Error("A was signed out at ID as well");
	console.log("   A is signed out of courts, and still signed in at ID.");
	if (!(await signedIn(b.context, COURTS))) throw new Error("B was signed out too");
	console.log("   B is still signed in.");

	console.log(
		"\n5. B signs out at ID, as on ID's account page: ID tells courts, which ends B's session there.",
	);
	const out = await b.context.request.post(`${ID}/api/auth/sign-out`, {
		headers: { origin: ID },
		data: {},
	});
	if (!out.ok()) throw new Error(`ID refused B's sign-out (${out.status()}): ${await out.text()}`);
	if (await signedIn(b.context, ID)) throw new Error("B is still signed in at ID");
	// Back-channel logout: ID's Worker posts to courts' /api/auth/backchannel-logout/oidc, retrying from a queue.
	const until = Date.now() + WAIT;
	while (await signedIn(b.context, COURTS)) {
		if (Date.now() > until) throw new Error("B signed out at ID, but is still signed in to courts");
		await new Promise((done) => setTimeout(done, 1_000));
	}
	console.log("   B is signed out of ID, and courts heard it and ended B's session.");

	console.log("\n6. Hallmark's lint on the signed-in pages, as deployed (saved in step 3).");
	// Over HTTP, as scripts/hallmark.mjs does: given a file, the lint would also read the built CSS beside it as
	// source. The home page is a page; Your bookings is an app screen.
	const types = {
		html: "text/html",
		css: "text/css",
		svg: "image/svg+xml",
		jpg: "image/jpeg",
		woff2: "font/woff2",
	};
	server = createServer((request, response) => {
		const path = join(
			SAVED,
			normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)),
		);
		if (!path.startsWith(`${SAVED}/`) || !existsSync(path)) return response.writeHead(404).end();
		response.writeHead(200, {
			"content-type": types[extname(path).slice(1)] ?? "application/octet-stream",
		});
		response.end(readFileSync(path));
	});
	await new Promise((listening) => server.listen(LINT_PORT, "127.0.0.1", listening));
	for (const [scope, file] of [
		["page", home],
		["app", bookings],
	]) {
		// Not spawnSync: that would stop this process, and the server above with it.
		const lint = await new Promise((done) => {
			const child = spawn("node", [
				".claude/skills/hallmark/scripts/sloplint.mjs",
				"src/styles.css",
				"src/styles",
				"--url",
				`http://127.0.0.1:${LINT_PORT}${file}`,
				"--render",
				"--genre",
				"editorial",
				"--scope",
				scope,
			]);
			const out = { stdout: "", stderr: "" };
			child.stdout.on("data", (d) => {
				out.stdout += d;
			});
			child.stderr.on("data", (d) => {
				out.stderr += d;
			});
			child.on("close", (status) => done({ ...out, status }));
		});
		process.stdout.write(lint.stdout.replace(/^/gm, "   "));
		if (lint.status !== 0 || !/clean\. 0 FAIL, 0 REFLEX, 0 WARN/.test(lint.stdout)) {
			throw new Error(
				`Hallmark's lint isn't clean on the signed-in ${file}: ${lint.stderr.trim()}`,
			);
		}
	}
} catch (error) {
	failed = true;
	console.error(`\nall:e2e failed: ${error instanceof Error ? error.message : error}`);
	for (const { name, context, page, went, refused } of watched) {
		const said = (
			await page
				.locator("body")
				.innerText()
				.catch(() => "")
		).replace(/\s+/g, " ");
		console.error(
			`\n   ${name} went to:\n     ${went.join("\n     ")}\n   and the page says: ${said.slice(0, 300)}`,
		);
		if (refused.length > 0)
			console.error(`   The browser's console said:\n     ${refused.join("\n     ")}`);
		console.error(
			`   Signed in now: courts ${await signedIn(context, COURTS).catch(() => "?")}, ID ${await signedIn(context, ID).catch(() => "?")}`,
		);
	}
} finally {
	await browser?.close();
	server?.close();
	console.log("\n7. The two people, deleted from ID and from courts.");
	try {
		inId(`DELETE FROM user WHERE email IN (${addresses})`);
		inId(`DELETE FROM deployment_invitation WHERE email IN (${addresses})`);
		inCourts(`DELETE FROM user WHERE email IN (${addresses})`);
		console.log("   Gone.");
	} catch (error) {
		failed = true;
		console.error(`   Couldn't delete them: ${error instanceof Error ? error.message : error}`);
	}
}
if (failed) process.exit(1);
console.log(
	"\nall:e2e passed: sign in through ID, a double booking refused, cancel, sign out of courts, sign out at ID ends courts, signed-in pages pass Hallmark.\n",
);
