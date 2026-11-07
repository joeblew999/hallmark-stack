// From Gateweave Track (github.com/gateweavehq/track) at b8b5ba0: apps/web/src/lib/sign-in-refusal.ts, worded for a
// site whose only way in is Gateweave ID: there is no password to fall back on, and no account here to link to.

const REFUSALS: Record<string, string> = {
	access_denied: "You chose not to sign in. Nothing was booked.",
	email_not_found: "Gateweave ID did not give us an email address for you, and bookings need one.",
};

/**
 * What to tell someone whose sign-in through Gateweave ID came back with this code. Only ever words
 * of ours, and never the `error_description` beside it: anyone can make a link, and it would put
 * their text on the page.
 */
export function signInRefusal(code: string | undefined): string | null {
	if (!code) return null;
	return Object.hasOwn(REFUSALS, code)
		? (REFUSALS[code] ?? null)
		: "Signing in did not work. Try again.";
}
