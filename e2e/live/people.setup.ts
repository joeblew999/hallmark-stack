// Two throwaway people, A and B, each made at Gateweave ID and signed in to courts, for the rest of the run. Made through
// ID's own invitation: a row for a made-up address holding only the SHA-256 of a random token, as ID's own "invite"
// writes it (ID's docs/architecture.md: the owner "could write the row themselves"). Accepting it with a password
// that exists only in this run makes the account and signs that browser in at ID. No email is sent, Turnstile doesn't
// stand in front of invitations, and two acceptances are well inside ID's 10 a minute (deployment.ts).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import {
	COURTS,
	ID,
	inCourts,
	inId,
	LIKE,
	open,
	PREFIX,
	personOf,
	STATE,
	signIn,
	stateOf,
} from "./target";

/** The columns this writes. They are ID's own schema, tied to the pinned ID_COMMIT: a new ID release may move them. */
const INVITATION = ["id", "email", "token_hash", "invited_by", "expires_at", "created_at"];

setup.describe.configure({ mode: "serial" });

let owner = "";

setup("what an earlier, killed run left is gone, and Gateweave ID is ready for invitations", () => {
	inId(`DELETE FROM user WHERE email LIKE ${LIKE}`);
	inId(`DELETE FROM deployment_invitation WHERE email LIKE ${LIKE}`);
	inCourts(`DELETE FROM user WHERE email LIKE ${LIKE}`);

	const columns = inId("PRAGMA table_info(deployment_invitation)").map(({ name }) => name);
	const missing = INVITATION.filter((column) => !columns.includes(column));
	expect(missing, `ID's deployment_invitation no longer has ${missing.join(", ")}`).toEqual([]);
	const [row] = inId("SELECT owner_id AS id FROM deployment WHERE id = 1");
	expect(row?.id, "Gateweave ID has no owner: run mise run id:claim first").toBeTruthy();
	owner = String(row?.id);
	mkdirSync(STATE, { recursive: true });
});

// One test per person, each with its own time: a sign-in goes through ID and back.
for (const who of ["a", "b"] as const) {
	setup(
		`person ${who.toUpperCase()}, invited into Gateweave ID and signed in to courts`,
		async ({ browser }) => {
			const name = `E2E Player ${who.toUpperCase()}`;
			const email = `${PREFIX}${who}-${randomUUID()}@example.com`;
			const token = randomBytes(32).toString("base64url");
			const now = Date.now();
			const hash = createHash("sha256").update(token).digest("base64url");
			inId(
				`INSERT INTO deployment_invitation (id, email, token_hash, invited_by, expires_at, created_at) VALUES ('${randomBytes(16).toString("hex")}', '${email}', '${hash}', '${owner}', ${now + 3_600_000}, ${now})`,
			);

			const context = await browser.newContext();
			const accepted = await context.request.post(`${ID}/api/auth/deployment/invitations/accept`, {
				headers: { origin: ID },
				data: { token, name, newPassword: randomBytes(24).toString("base64url") },
			});
			expect(accepted.ok(), `ID refused the invitation: ${await accepted.text()}`).toBe(true);

			// courts' header "Sign in": to ID, where they are signed in already, and straight back with a session here.
			const page = await context.newPage();
			await open(page, "/");
			await signIn(page);
			await expect(page.getByRole("link", { name: "Your bookings" })).toBeVisible();
			expect(page.url().startsWith(COURTS)).toBe(true);

			await context.storageState({ path: stateOf(who) });
			await context.close();
			writeFileSync(personOf(who), JSON.stringify({ name, email }));
		},
	);
}
