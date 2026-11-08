import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer, SiteHeader } from "#/components/site/chrome";
import { CourtPhoto } from "#/components/site/sections";
import { loadAvailability } from "#/lib/bookings";
import { PAGES } from "#/lib/pages";

// The front door: what Eastfield is, and the way to each page (src/lib/pages.ts) on the ultramarine field where
// the Book page has its booker. Booking is its own page.
export const Route = createFileRoute("/")({
	loader: () => loadAvailability(),
	component: Home,
});

function Home() {
	const { user } = Route.useLoaderData();
	return (
		<>
			<SiteHeader signedIn={user !== null} />
			<main id="main">
				<section className="hero hero--door" aria-labelledby="hero-title">
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
								<Link className="btn" to="/book">
									Book a court
								</Link>
								<Link className="link" to="/courts">
									See the site plan
								</Link>
							</div>
						</div>
						<nav className="door" aria-labelledby="door-title">
							<h2 id="door-title">Everything at Eastfield</h2>
							<ol>
								{PAGES.map((p) => (
									<li key={p.to}>
										<Link className="door__link" to={p.to}>
											<b>{p.label}</b>
											<span>{p.job}</span>
										</Link>
									</li>
								))}
							</ol>
						</nav>
					</div>
				</section>
				<CourtPhoto />
			</main>
			<Footer />
		</>
	);
}
