import { createFileRoute } from "@tanstack/react-router";
import { BookingProvider } from "#/components/site/booking";
import { Footer, SiteHeader } from "#/components/site/chrome";
import { FreeToday, Visit } from "#/components/site/sections";
import { loadAvailability } from "#/lib/bookings";

// Visiting: opening hours, the address, and what's free today (each a link to the Book page with it picked).
export const Route = createFileRoute("/visit")({
	loader: () => loadAvailability(),
	head: () => ({ meta: [{ title: "Visit: Eastfield Courts" }] }),
	component: VisitPage,
});

function VisitPage() {
	const { days, taken, user } = Route.useLoaderData();
	return (
		<BookingProvider days={days} taken={taken}>
			<SiteHeader signedIn={user !== null} />
			<main id="main">
				<Visit />
				<FreeToday />
			</main>
			<Footer />
		</BookingProvider>
	);
}
