import { createFileRoute } from "@tanstack/react-router";
import { Footer, SiteHeader } from "#/components/site/chrome";
import { Coaching, CoachingNote } from "#/components/site/sections";
import { loadAvailability } from "#/lib/bookings";

// Coaching: the weekly group sessions.
export const Route = createFileRoute("/coaching")({
	loader: () => loadAvailability(),
	head: () => ({ meta: [{ title: "Coaching: Eastfield Courts" }] }),
	component: CoachingPage,
});

function CoachingPage() {
	const { user } = Route.useLoaderData();
	return (
		<>
			<SiteHeader signedIn={user !== null} />
			<main id="main">
				<Coaching />
				<CoachingNote />
			</main>
			<Footer />
		</>
	);
}
