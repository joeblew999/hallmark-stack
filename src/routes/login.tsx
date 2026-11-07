import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { PlainNav } from "#/components/site/chrome";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/login")({
	validateSearch: z.object({ mode: z.enum(["sign-in", "sign-up"]).optional() }),
	head: () => ({ meta: [{ title: "Sign in to book: Eastfield Courts" }] }),
	component: Login,
});

function Login() {
	const { mode = "sign-in" } = Route.useSearch();
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const signUp = mode === "sign-up";

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const email = String(form.get("email") ?? "");
		const password = String(form.get("password") ?? "");
		setBusy(true);
		setError("");
		const { error } = signUp
			? await authClient.signUp.email({ email, password, name: String(form.get("name") ?? "") })
			: await authClient.signIn.email({ email, password });
		setBusy(false);
		if (error) {
			setError(error.message ?? "That didn’t work. Check the email and password.");
			return;
		}
		await navigate({ to: "/", hash: "book" });
	}

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
						<h1>{signUp ? "An account, then a court." : "Sign in to book."}</h1>
						<p className="lead">
							{signUp
								? "Your name, an email and a password."
								: "Your bookings stay with your account."}
						</p>
					</div>
					{/* POST, so a submit before hydration can never put the password in the URL. */}
					<form className="auth__form" method="post" onSubmit={submit}>
						{signUp && (
							<p className="field">
								<label htmlFor="name">Name</label>
								<input id="name" name="name" autoComplete="name" required />
							</p>
						)}
						<p className="field">
							<label htmlFor="email">Email</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								inputMode="email"
								required
							/>
						</p>
						<p className="field">
							<label htmlFor="password">Password</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete={signUp ? "new-password" : "current-password"}
								minLength={10}
								required
							/>
						</p>
						<div className="auth__go">
							<button className="btn" type="submit" disabled={busy} aria-busy={busy}>
								{signUp ? "Make the account" : "Sign in"}
							</button>
							<Link className="link" to="/login" search={{ mode: signUp ? "sign-in" : "sign-up" }}>
								{signUp ? "I have an account" : "I need an account"}
							</Link>
						</div>
						<p className="auth__msg" role="alert">
							{error}
						</p>
					</form>
				</div>
			</main>
		</>
	);
}
