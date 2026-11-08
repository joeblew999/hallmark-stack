import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { signInHref } from "#/components/site/account";
import { Booker } from "#/components/site/booker";
import { BookingProvider } from "#/components/site/booking";
import { Footer, SiteHeader } from "#/components/site/chrome";
import { BookingBar, FindCourt } from "#/components/site/sections";
import { bookCourt, loadAvailability } from "#/lib/bookings";
import { courtById, HOURS, type Hour } from "#/lib/courts";

// Booking: day, hour and court, then book. A link from the site plan or Free today arrives with them picked
// (?date=&hour=&court=); anything that isn't a real day, hour or court is dropped.
export const Route = createFileRoute("/book")({
	validateSearch: z.object({
		date: z.string().optional().catch(undefined),
		hour: z.enum(HOURS).optional().catch(undefined),
		court: z.string().optional().catch(undefined),
	}),
	loader: () => loadAvailability(),
	head: () => ({ meta: [{ title: "Book a court: Eastfield Courts" }] }),
	component: Book,
});

function Book() {
	const { days, taken, user } = Route.useLoaderData();
	const picked = Route.useSearch();
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
				// Straight to Gateweave ID, and back here; nothing was booked.
				window.location.assign(signInHref("/book"));
				return "Taking you to Gateweave ID to sign in.";
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
		<BookingProvider
			days={days}
			taken={taken}
			initial={{ date: picked.date, hour: picked.hour, court: courtById(picked.court ?? "")?.id }}
		>
			<SiteHeader signedIn={user !== null} />
			<main id="main">
				<section className="hero" aria-labelledby="hero-title">
					<div className="container hero__grid">
						<div className="hero__text">
							<h1 id="hero-title">Book a court.</h1>
							<p className="lead">
								Pick a day and a start time; the first free court is chosen for you.
							</p>
							<FindCourt />
						</div>
						<Booker onBook={book} />
					</div>
				</section>
			</main>
			<BookingBar />
			<Footer />
		</BookingProvider>
	);
}
