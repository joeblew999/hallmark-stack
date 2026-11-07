import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
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
import { bookableDays } from "#/lib/courts";
import { sampleTaken } from "#/lib/sample";

/** The venue's time zone: it decides what "today" is. */
const VENUE_TIME_ZONE = "Asia/Bangkok";

const loadAvailability = createServerFn({ method: "GET" }).handler(async () => {
	const days = bookableDays(new Date(), VENUE_TIME_ZONE);
	return { days, taken: sampleTaken(days) };
});

export const Route = createFileRoute("/")({
	loader: () => loadAvailability(),
	component: Home,
});

function Home() {
	const { days, taken } = Route.useLoaderData();
	return (
		<BookingProvider days={days} taken={taken}>
			<a className="skip" href="#main">
				Skip to content
			</a>
			<SiteNav />
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
						<Booker onBook={async () => "Nothing was booked: online booking is not connected yet."} />
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
