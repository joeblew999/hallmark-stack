import { expect, type Page, test } from "@playwright/test";

// What a browser shows with nobody signed in. Signing in is Gateweave ID's, which runs on Cloudflare only, so this
// build has none (no OIDC_* settings): signing in, booking, a double booking refused, cancelling and signing out
// through the real ID are `mise run all:e2e`, against the deployed sites.

/** Opens a page and waits until React has hydrated it (the root sets data-hydrated). */
async function open(page: Page, path: string) {
	await page.goto(path);
	await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

test("the home page shows the booker without signing in", async ({ page }) => {
	await open(page, "/");
	await expect(page.getByRole("heading", { level: 1 })).toContainText("Pick an hour.");
	await expect(page.locator(".booker__hour")).toHaveText("19:00");
	await page.locator('label[for="t-18:00"]').click();
	await expect(page.locator(".booker__hour")).toHaveText("18:00");
});

test("the sign-in button waits for the page's script, then works", async ({ page }) => {
	await page.goto("/");
	const signIn = page.locator(".nav").getByRole("button", { name: "Sign in" });
	await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
	await expect(signIn).toBeEnabled();
	await signIn.click();
	// With no ID here, the button says so rather than doing nothing.
	await expect(page.locator(".nav [role=alert]")).toContainText("We could not reach Gateweave ID.");
});

test("booking signed out goes to sign in, and says why when it can't", async ({ page }) => {
	await open(page, "/");
	await page.locator(".booker .btn").click();
	await expect(page.locator(".booker")).toContainText("We could not reach Gateweave ID.");
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
	await expect(page.getByRole("button", { name: "Sign in or create account" })).toBeEnabled();
});
