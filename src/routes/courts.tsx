import { createFileRoute } from "@tanstack/react-router";
import { BookingProvider } from "#/components/site/booking";
import { Footer, SiteHeader } from "#/components/site/chrome";
import { Games, SitePlan } from "#/components/site/sections";
import { loadAvailability } from "#/lib/bookings";

// The courts: the site plan (each free court a link to the Book page with it picked), and what each game needs.
export const Route = createFileRoute("/courts")({
	loader: () => loadAvailability(),
	head: () => ({ meta: [{ title: "The courts: Eastfield Courts" }] }),
	component: Courts,
});

function Courts() {
	const { days, taken, user } = Route.useLoaderData();
	return (
		<BookingProvider days={days} taken={taken}>
			<SiteHeader signedIn={user !== null} />
			<main id="main">
				<SitePlan />
				<Games />
			</main>
			<Footer />
		</BookingProvider>
	);
}
