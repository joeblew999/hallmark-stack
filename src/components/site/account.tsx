// Signing in and out, Gateweave ID's way, without the page's script: a link and a form to courts' own routes
// (src/server/auth/sign-in-out.ts), so the first press works the moment it is on screen. From Track's ProviderButton
// and sign-out (apps/web/src/routes/login.tsx and its account menu at b8b5ba0), which called Better Auth from the
// browser behind a button that waited for the script (LiveButton); the routes call the same endpoints.

/** Where "Sign in" goes: Gateweave ID, and back to `next` (a path on this site) once signed in. */
export const signInHref = (next: string) => `/sign-in?next=${encodeURIComponent(next)}`;

/** "Sign in or create account": the one way in. ID's own page offers both. */
export function SignInButton({
	next,
	className = "btn",
	label = "Sign in or create account",
}: {
	next: string;
	className?: string;
	label?: string;
}) {
	return (
		<a className={className} href={signInHref(next)}>
			{label}
		</a>
	);
}

/**
 * Signs out of this site, and leaves the person signed in at Gateweave ID, as Track does. Signing out
 * at ID (its account page) signs them out here too, through back-channel logout. Signing out of both
 * in one go, through ID's end-session, waits on two problems in Gateweave ID, seen on v0.10.4 and
 * still in v0.11.4 (issue #7). A form, so it works before the script; the server sends a fresh home page.
 */
export function SignOutButton({ className }: { className?: string }) {
	return (
		<form className="signout" method="post" action="/sign-out">
			<button className={className ?? "btn"} type="submit">
				Sign out
			</button>
		</form>
	);
}
