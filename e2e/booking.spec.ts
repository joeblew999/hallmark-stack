import { expect, type Page, test } from "@playwright/test";

// What a browser shows with nobody signed in, on the production build with no Gateweave ID (no OIDC_* settings): the
// pages, the nav between them, the booker. Signing in, booking, a double booking refused, cancelling and signing out
// through a real ID are `mise run all:e2e <env>`: development (mise run all:dev), staging or production.

/** Opens a page and waits until React has hydrated it (the root sets data-hydrated). */
async function open(page: Page, path: string) {
	await page.goto(path);
	await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

test("the home page leads to every page, and the nav is on every page", async ({ page }) => {
	await open(page, "/");
	await expect(page.getByRole("heading", { level: 1 })).toContainText("Pick an hour.");
	const pages = ["Book", "Courts", "Coaching", "Visit"];
	for (const name of pages) {
		await expect(
			page.locator(".door").getByRole("link", { name: new RegExp(`^${name}`) }),
		).toBeVisible();
	}
	for (const name of pages) {
		await page.locator(".nav__pages").getByRole("link", { name }).click();
		await expect(page.locator(".nav__pages [aria-current=page]")).toHaveText(name);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	}
});

test("a free court on the site plan opens the booker with it picked", async ({ page }) => {
	await open(page, "/courts");
	await page.locator(".plan__svg a:not(.is-taken)").nth(1).click();
	await expect(page).toHaveURL(/\/book\?/);
	await expect(page.locator(".courts input:checked")).toHaveCount(1);
	await expect(page.locator(".booker__day")).not.toContainText("Court 1,");
});

test("the Book page shows the booker without signing in", async ({ page }) => {
	await open(page, "/book");
	await expect(page.getByRole("heading", { level: 1 })).toContainText("Book a court.");
	await expect(page.locator(".booker__hour")).toHaveText("19:00");
	await page.locator('label[for="t-18:00"]').click();
	await expect(page.locator(".booker__hour")).toHaveText("18:00");
});

test("Sign in works on the first press, before the page's script has loaded", async ({ page }) => {
	// No script at all: Sign in is a plain link to courts' /sign-in (src/server/auth/sign-in-out.ts).
	await page.route(/\.(js|mjs)(\?|$)/, (route) => route.abort());
	await page.goto("/");
	await page.locator(".nav").getByRole("link", { name: "Sign in" }).click();
	// With no ID here, the sign-in page says so rather than nothing happening.
	await expect(page).toHaveURL(/\/login\?error=unavailable/);
	await expect(page.locator(".auth")).toContainText("We could not reach Gateweave ID.");
});

test("booking signed out goes to sign in, and says why when it can't", async ({ page }) => {
	await open(page, "/book");
	await page.locator(".booker .btn").click();
	await expect(page).toHaveURL(/\/login\?error=unavailable/);
	await expect(page.locator(".auth")).toContainText("We could not reach Gateweave ID.");
});

test("Sign out is a form, so it works without the script, and only from this site", async ({
	request,
	baseURL,
}) => {
	const fromHere = await request.post("/sign-out", {
		headers: { origin: new URL(baseURL ?? "").origin },
		maxRedirects: 0,
	});
	expect(fromHere.status()).toBe(303);
	expect(fromHere.headers().location).toMatch(/\/$/);
	const fromElsewhere = await request.post("/sign-out", {
		headers: { origin: "https://elsewhere.example" },
		maxRedirects: 0,
	});
	expect(fromElsewhere.status()).toBe(403);
});

test("the sign-in page says signing in isn't set up, and has no password", async ({ page }) => {
	await open(page, "/login");
	await expect(page.locator(".auth__head")).toContainText("Signing in isn’t set up");
	await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test("a refused sign-in is explained in courts' own words, never the URL's", async ({ page }) => {
	await open(page, "/login?error=access_denied");
	await expect(page.locator(".auth")).toContainText(
		"You chose not to sign in. Nothing was booked.",
	);
	await open(page, "/login?error=<b>anything+at+all</b>");
	await expect(page.locator(".auth")).toContainText("Signing in did not work. Try again.");
	await expect(page.locator(".auth")).not.toContainText("anything at all");
});

test("the bookings page asks to sign in", async ({ page }) => {
	await open(page, "/bookings");
	await expect(page.locator(".mine__head")).toContainText("Sign in to see what you’ve booked.");
	await expect(page.getByRole("link", { name: "Sign in or create account" })).toHaveAttribute(
		"href",
		"/sign-in?next=%2Fbookings",
	);
});
