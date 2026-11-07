import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { SignInButton, SignOutButton } from "#/components/site/account";
import { PlainNav } from "#/components/site/chrome";
import { cancelBooking, myBookings } from "#/lib/bookings";
import { courtById } from "#/lib/courts";

export const Route = createFileRoute("/bookings")({
	loader: () => myBookings(),
	head: () => ({ meta: [{ title: "Your bookings: Eastfield Courts" }] }),
	component: Bookings,
});

const longDate = new Intl.DateTimeFormat("en-GB", {
	weekday: "long",
	day: "numeric",
	month: "long",
	timeZone: "UTC",
});

function Bookings() {
	const { user, bookings } = Route.useLoaderData();
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);

	async function cancel(id: string) {
		setBusy(id);
		await cancelBooking({ data: id });
		setBusy(null);
		await router.invalidate();
	}

	return (
		<>
			<PlainNav
				action={
					<Link className="link nav__book" to="/" hash="book">
						Book a court
					</Link>
				}
			/>
			<main id="main" className="mine">
				<div className="container mine__grid">
					<div className="mine__head">
						<h1>Your courts.</h1>
						<p className="lead">
							{user
								? `Signed in as ${user.name} (${user.email}), through Gateweave ID.`
								: "Sign in to see what you’ve booked."}
						</p>
						{user && (
							<p className="mine__account">
								{user.account && (
									<span>
										To sign out everywhere:{" "}
										<a className="link" href={user.account}>
											Your Gateweave ID account
										</a>
									</span>
								)}
								<SignOutButton className="link link--button" />
							</p>
						)}
					</div>
					{!user ? (
						<p className="mine__empty">
							<SignInButton next="/bookings" />
						</p>
					) : bookings.length === 0 ? (
						<div className="mine__empty">
							<p>Nothing booked from today on. Pick an hour and a court on the booker.</p>
							<Link className="btn" to="/" hash="book">
								Book a court
							</Link>
						</div>
					) : (
						<table className="week mine__table">
							<caption className="visually-hidden">Your bookings from today on</caption>
							<thead>
								<tr>
									<th scope="col">Day</th>
									<th scope="col">Start</th>
									<th scope="col">Court</th>
									<th scope="col">
										<span className="visually-hidden">Cancel</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{bookings.map((b) => (
									<tr key={b.id}>
										<th scope="row">{longDate.format(new Date(`${b.date}T00:00:00Z`))}</th>
										<td>{b.hour}</td>
										<td>{courtById(b.courtId)?.name ?? "A court no longer listed"}</td>
										<td>
											<button
												className="link link--button"
												type="button"
												disabled={busy === b.id}
												onClick={() => cancel(b.id)}
											>
												Cancel
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</main>
		</>
	);
}
