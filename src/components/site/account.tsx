import { useState } from "react";
import { authClient } from "#/lib/auth-client";
import { LiveButton } from "./live-button";

/** Better Auth's id for Gateweave ID (OIDC_PROVIDER in src/server/auth/oidc-sign-in.ts, out of the browser's reach). */
const OIDC_PROVIDER = "oidc";

/** Where a refused sign-in comes back to: the page that explains why (src/routes/login.tsx). */
const REFUSED = "/login";

/**
 * Sends the browser to Gateweave ID, and back to `next` once signed in. ID's own page offers both
 * signing in and making an account, and carries the request across either way. As Track's
 * ProviderButton (apps/web/src/routes/login.tsx at b8b5ba0): the site finds out ID is down only now.
 */
export async function startSignIn(next: string): Promise<string | null> {
	const { error } = await authClient.signIn.social({
		provider: OIDC_PROVIDER,
		callbackURL: next,
		errorCallbackURL: REFUSED,
	});
	if (!error) return null;
	return error.code === "PROVIDER_NOT_FOUND"
		? "We could not reach Gateweave ID. Try again."
		: (error.message ?? "Signing in did not work. Try again.");
}

/** "Sign in or create account": the one way in. */
export function SignInButton({
	next,
	className,
	label = "Sign in or create account",
}: {
	next: string;
	className?: string;
	label?: string;
}) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onClick() {
		setPending(true);
		setError(null);
		setError(await startSignIn(next));
		// Going back from ID can bring this page back as it was, so it must not stay disabled.
		setPending(false);
	}

	return (
		<>
			<LiveButton className={className} disabled={pending} onClick={onClick}>
				{label}
			</LiveButton>
			{error && (
				<span className="auth__msg" role="alert">
					{error}
				</span>
			)}
		</>
	);
}

/**
 * Signs out of this site, and leaves the person signed in at Gateweave ID, as Track does. Signing out
 * at ID (its account page) signs them out here too, through back-channel logout. Signing out of both
 * in one go, through ID's end-session, waits on two problems in Gateweave ID, seen on v0.10.4 and
 * still in v0.10.6 (issue #3).
 */
export function SignOutButton({ className }: { className?: string }) {
	const [pending, setPending] = useState(false);

	async function onClick() {
		setPending(true);
		await authClient.signOut();
		// A fresh page, so nothing of theirs stays on screen.
		window.location.assign("/");
	}

	return (
		<LiveButton className={className} disabled={pending} onClick={onClick}>
			Sign out
		</LiveButton>
	);
}
