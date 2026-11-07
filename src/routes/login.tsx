import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { SignInButton } from "#/components/site/account";
import { PlainNav } from "#/components/site/chrome";
import { signInOptions } from "#/lib/bookings";
import { signInRefusal } from "#/lib/sign-in-refusal";

// Signing in is Gateweave ID's: the button anywhere on the site goes straight there. This page is where a sign-in
// that ID or the site refused comes back to (`errorCallbackURL` in src/components/site/account.tsx), so it says why,
// in words of ours, and offers the button again.
export const Route = createFileRoute("/login")({
	validateSearch: z.object({ error: z.string().optional().catch(undefined) }),
	loader: () => signInOptions(),
	head: () => ({ meta: [{ title: "Sign in to book: Eastfield Courts" }] }),
	component: Login,
});

function Login() {
	const { error } = Route.useSearch();
	const { provider } = Route.useLoaderData();
	const refusal = signInRefusal(error);

	return (
		<>
			<PlainNav
				action={
					<Link className="link nav__book" to="/">
						Back to the booker
					</Link>
				}
			/>
			<main id="main" className="auth">
				<div className="container auth__grid">
					<div className="auth__head">
						<h1>Sign in to book.</h1>
						<p className="lead">
							{provider
								? `One ${provider} account signs you in here. New? Make one there; it brings you straight back.`
								: "Signing in isn’t set up on this site yet."}
						</p>
					</div>
					<div className="auth__body">
						{refusal && (
							<p className="auth__msg" role="alert">
								{refusal}
							</p>
						)}
						{provider && (
							<div className="auth__provider">
								<SignInButton next="/#book" />
							</div>
						)}
					</div>
				</div>
			</main>
		</>
	);
}
