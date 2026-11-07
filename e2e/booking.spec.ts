import { expect, type Page, test } from "@playwright/test";

/** Opens a page and waits until React has hydrated it (the root sets data-hydrated). */
async function open(page: Page, path: string) {
	await page.goto(path);
	await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

async function signUp(page: Page): Promise<string> {
	const email = `player-${crypto.randomUUID()}@example.com`;
	await open(page, "/login?mode=sign-up");
	await page.getByLabel("Name").fill("Test Player");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill("correct horse battery");
	await page.getByRole("button", { name: "Make the account" }).click();
	await expect(page.getByRole("link", { name: "Your bookings" })).toBeVisible();
	return email;
}

/** A start time with at least one free court on the first day, and that court's booker label. */
async function pickFreeHour(page: Page, hour: string) {
	await page.locator(`label[for="t-${hour}"]`).click();
	const button = page.locator(".booker .btn");
	await expect(button).toContainText(`at ${hour}`);
	return (await button.textContent())?.replace("Book ", "").replace(` at ${hour}`, "") ?? "";
}

test("the home page shows the booker without signing in", async ({ page }) => {
	await open(page, "/");
	await expect(page.getByRole("heading", { level: 1 })).toContainText("Pick an hour.");
	await expect(page.locator(".booker__hour")).toHaveText("19:00");
	await page.locator('label[for="t-18:00"]').click();
	await expect(page.locator(".booker__hour")).toHaveText("18:00");
});

test("booking signed out goes to sign in", async ({ page }) => {
	await open(page, "/");
	await page.locator(".booker .btn").click();
	await expect(page).toHaveURL(/\/login/);
});

test("book a court, see it taken for someone else, then cancel it", async ({ browser }) => {
	const a = await (await browser.newContext()).newPage();
	await signUp(a);
	const hour = "21:00";
	const court = await pickFreeHour(a, hour);
	await a.locator(".booker .btn").click();
	await expect(a.locator(".booker__msg")).toContainText(`Booked: ${court}`);

	// Someone else sees that court taken at that hour, in the booker and on the plan.
	const b = await (await browser.newContext()).newPage();
	await signUp(b);
	await b.locator(`label[for="t-${hour}"]`).click();
	const row = b.locator(".courts label", { hasText: new RegExp(`^${court}`, "i") });
	await expect(row).toContainText("taken");

	// It is under A's bookings, and cancelling frees it.
	await open(a, "/bookings");
	await expect(a.locator(".mine__table tbody tr")).toHaveCount(1);
	await a.getByRole("button", { name: "Cancel" }).click();
	await expect(a.locator(".mine__empty")).toBeVisible();
	await open(b, "/");
	await b.locator(`label[for="t-${hour}"]`).click();
	await expect(
		b.locator(".courts label", { hasText: new RegExp(`^${court}`, "i") }),
	).not.toContainText("taken");
});

test("two people cannot book the same court and hour", async ({ browser }) => {
	const a = await (await browser.newContext()).newPage();
	const b = await (await browser.newContext()).newPage();
	await signUp(a);
	await signUp(b);
	const hour = "17:00";
	const courtA = await pickFreeHour(a, hour);
	const courtB = await pickFreeHour(b, hour);
	expect(courtB).toBe(courtA);
	await a.locator(".booker .btn").click();
	await expect(a.locator(".booker__msg")).toContainText("Booked");
	// B's page still shows the court free; the Durable Object refuses the second booking.
	await b.locator(".booker .btn").click();
	await expect(b.locator(".booker__msg")).toContainText("Someone took");
	await open(a, "/bookings");
	await a.getByRole("button", { name: "Cancel" }).click();
	await expect(a.locator(".mine__empty")).toBeVisible();
});
