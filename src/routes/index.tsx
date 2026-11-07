import { createFileRoute, useRouter } from "@tanstack/react-router";
import { startSignIn } from "#/components/site/account";
import { Booker } from "#/components/site/booker";
import { BookingProvider } from "#/components/site/booking";
import {
	BookingBar,
	Coaching,
	CourtPhoto,
	Footer,
	Games,
	SiteNav,
	SitePlan,
	Visit,
} from "#/components/site/sections";
import { bookCourt, loadAvailability } from "#/lib/bookings";
import { courtById, type Hour } from "#/lib/courts";

export const Route = createFileRoute("/")({
	loader: () => loadAvailability(),
	component: Home,
});

function Home() {
	const { days, taken, user } = Route.useLoaderData();
	const router = useRouter();

	async function book(courtId: string, date: string, hour: Hour): Promise<string> {
		const court = courtById(courtId);
		const day = days.find((d) => d.date === date);
		try {
			const result = await bookCourt({ data: { courtId, date, hour } });
			if (result.ok) {
				await router.invalidate();
				return `Booked: ${court?.short}, ${day?.label ?? date} at ${hour}. It’s under Your bookings.`;
			}
			if (result.reason === "signed-out") {
				// Straight to Gateweave ID, and back to the booker; nothing was booked.
				return (await startSignIn("/#book")) ?? "Taking you to Gateweave ID to sign in.";
			}
			if (result.reason === "taken") {
				await router.invalidate();
				return `Someone took ${court?.short} at ${hour} a moment ago. Pick another court.`;
			}
			return "That time can’t be booked. Pick another.";
		} catch {
			return "The booking didn’t reach the server. Nothing was booked; try again in a minute.";
		}
	}

	return (
		<BookingProvider days={days} taken={taken}>
			<a className="skip" href="#main">
				Skip to content
			</a>
			<SiteNav signedIn={user !== null} />
			<main id="main">
				<section className="hero" aria-labelledby="hero-title">
					<div className="container hero__grid">
						<div className="hero__text">
							<h1 id="hero-title">
								Pick an hour.
								<br />
								The court
								<br />
								is yours.
							</h1>
							<p className="lead">Tennis, padel and five-a-side: see what’s free, then play.</p>
							<div className="hero__actions">
								<a className="link" href="#plan">
									See the site plan
								</a>
							</div>
						</div>
						<Booker onBook={book} />
					</div>
				</section>
				<CourtPhoto />
				<SitePlan />
				<Games />
				<Coaching />
				<Visit />
			</main>
			<BookingBar />
			<Footer />
		</BookingProvider>
	);
}
