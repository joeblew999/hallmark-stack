import { Link } from "@tanstack/react-router";
import { PAGES } from "#/lib/pages";
import { SignInButton, SignOutButton } from "./account";

/**
 * The header on every page: the wordmark home, the site's pages (src/lib/pages.ts), and the way in or out.
 * Signing in and out is Gateweave ID's (src/components/site/account.tsx).
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
	return (
		<>
			<a className="skip" href="#main">
				Skip to content
			</a>
			<header className="nav">
				<div className="container nav__inner">
					<Link className="wordmark" to="/" aria-label="Eastfield Courts, home">
						<span>Eastfield</span>
						<span>Courts</span>
					</Link>
					<nav className="nav__pages" aria-label="Pages">
						<ul>
							{PAGES.map((p) => (
								<li key={p.to}>
									<Link to={p.to} activeProps={{ "aria-current": "page" }}>
										{p.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>
					<div className="nav__book">
						{signedIn ? (
							<>
								<Link className="link" to="/bookings" activeProps={{ "aria-current": "page" }}>
									Your bookings
								</Link>
								<SignOutButton className="link link--button" />
							</>
						) : (
							<SignInButton next="/book" className="link link--button" label="Sign in" />
						)}
					</div>
				</div>
			</header>
		</>
	);
}

/** The footer on every page: the pages again, and the photographs' credits. */
export function Footer() {
	return (
		<footer className="foot">
			<div className="container foot__inner">
				<p className="foot__mark">Eastfield Courts</p>
				<nav className="foot__col" aria-label="Pages, again">
					<ul className="foot__pages">
						{PAGES.map((p) => (
							<li key={p.to}>
								<Link className="link" to={p.to}>
									{p.label}
								</Link>
							</li>
						))}
					</ul>
				</nav>
				<p className="foot__credits" data-credits>
					Photographs:{" "}
					<a
						className="link"
						href="https://commons.wikimedia.org/wiki/File:Rich%C3%A8l_Hogenkamp_-_Masters_de_Madrid_2015_-_11.jpg"
					>
						Carlos Delgado
					</a>{" "}
					(CC BY-SA 4.0),{" "}
					<a
						className="link"
						href="https://commons.wikimedia.org/wiki/File:Goal_on_the_move_(5772132849).jpg"
					>
						Håkan Dahlström
					</a>{" "}
					(CC BY 2.0), Wikimedia Commons.
				</p>
			</div>
		</footer>
	);
}
