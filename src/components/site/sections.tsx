import { Link } from "@tanstack/react-router";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { COURTS, HOURS, type Hour } from "#/lib/courts";
import { useBooking } from "./booking";

const scrollToBooker = () => document.getElementById("book")?.scrollIntoView();

/** The search-led bar: the wordmark, a search that jumps the booker to a court or a time, and Book. */
export function SiteNav({ signedIn }: { signedIn: boolean }) {
	const { pick, setHour } = useBooking();
	const input = useRef<HTMLInputElement>(null);
	const [message, setMessage] = useState("");

	useEffect(() => {
		const onKey = (e: globalThis.KeyboardEvent) => {
			const tag = (document.activeElement?.tagName ?? "").toLowerCase();
			if (e.key === "/" && tag !== "input" && tag !== "textarea") {
				e.preventDefault();
				input.current?.focus();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	function search(event: FormEvent) {
		event.preventDefault();
		const q = (input.current?.value ?? "").trim().toLowerCase();
		const digits = q.replace(/[^0-9]/g, "").slice(0, 2);
		const hour = digits ? HOURS.find((h) => h.startsWith(digits)) : undefined;
		if (hour) setHour(hour);
		const match = COURTS.find((c) => c.name.toLowerCase().includes(q) || c.sport.includes(q));
		const found = q !== "" && match !== undefined && pick(match.id);
		if (hour || found) {
			setMessage("");
			scrollToBooker();
		} else setMessage("No court or time matches that. Try “padel” or “18:00”.");
	}

	return (
		<header className="nav">
			<div className="container nav__inner">
				<a className="wordmark" href="/" aria-label="Eastfield Courts, home">
					<span>Eastfield</span>
					<span>Courts</span>
				</a>
				<search className="search">
					<form onSubmit={search}>
						<label className="visually-hidden" htmlFor="q">
							Find a court or a time
						</label>
						<input
							ref={input}
							id="q"
							name="q"
							type="search"
							placeholder="Find a court or a time"
							autoComplete="off"
							enterKeyHint="search"
						/>
						<kbd>/</kbd>
						<p className="search__msg" aria-live="polite">
							{message}
						</p>
					</form>
				</search>
				{signedIn ? (
					<Link className="link nav__book" to="/bookings">
						Your bookings
					</Link>
				) : (
					<Link className="link nav__book" to="/login">
						Sign in
					</Link>
				)}
			</div>
		</header>
	);
}

export function CourtPhoto() {
	return (
		<div className="bleed-wrap">
			<div className="container bleed-grid">
				<figure
					className="bleed"
					data-slot="court-photo"
					data-alt="Your own courts in play, square crop, daylight"
				>
					<img
						src="/images/clay-court.jpg"
						width={1920}
						height={1280}
						loading="lazy"
						sizes="(min-width: 60rem) 70vw, 100vw"
						alt="A player stretching for a backhand on a clay court"
						style={{ objectPosition: "55% 20%" }}
					/>
				</figure>
			</div>
		</div>
	);
}

/** Court markings, drawn per court; geometry of the sample site plan (viewBox 1312 x 560). */
const PLAN: Record<
	string,
	{
		rect: [number, number, number, number];
		marks: string;
		label: [number, number];
		circle?: [number, number, number];
	}
> = {};
COURTS.forEach((c, i) => {
	if (c.sport === "tennis") {
		const x = i * 174;
		const l = x + 24;
		PLAN[c.id] = {
			rect: [x, 40, 150, 320],
			marks: `M${l} 70h102v260H${l}zM${l} 200h102M${l + 51} 110v180M${l} 110h102M${l} 290h102`,
			label: [x + 16, 400],
		};
	}
});
const [padelA, padelB, pitch] = COURTS.filter((c) => c.sport !== "tennis");
if (padelA)
	PLAN[padelA.id] = { rect: [894, 40, 190, 96], marks: "M989 52v72M914 88h150", label: [910, 166] };
if (padelB)
	PLAN[padelB.id] = {
		rect: [1104, 40, 190, 96],
		marks: "M1199 52v72M1124 88h150",
		label: [1120, 166],
	};
if (pitch)
	PLAN[pitch.id] = {
		rect: [894, 196, 400, 164],
		marks: "M1094 212v132M914 248h40v60h-40M1274 248h-40v60h40",
		label: [910, 400],
		circle: [1094, 278, 30],
	};

/** The site plan: every court as a diagram; your pick in red, taken courts a tone darker. Click a free one to book it. */
export function SitePlan() {
	const { court, hour, isTaken, pick } = useBooking();
	return (
		<section className="plan" id="plan" aria-labelledby="plan-title">
			<div className="container">
				<div className="plan__head">
					<h2 id="plan-title">Clay courts, padel cages, one pitch.</h2>
					<p className="lead">Click a court to book it for the hour you picked.</p>
				</div>
				<div className="plan__map">
					<svg className="plan__svg" viewBox="0 0 1312 560">
						<title>Site plan of Eastfield Courts: each court is a link that picks it</title>
						{COURTS.map((c) => {
							const g = PLAN[c.id];
							if (!g) return null;
							const taken = isTaken(c.id);
							const cls = taken ? "is-taken" : court?.id === c.id ? "is-pick" : undefined;
							return (
								// biome-ignore lint/a11y/useValidAnchor: a real link to the booker (#book) that also picks the court on the way
								<a
									key={c.id}
									href="#book"
									className={cls}
									aria-label={`${c.name}, ${taken ? "taken" : "free"} at ${hour}`}
									onClick={(e) => {
										if (!pick(c.id)) e.preventDefault();
									}}
								>
									<rect
										className="c"
										x={g.rect[0]}
										y={g.rect[1]}
										width={g.rect[2]}
										height={g.rect[3]}
									/>
									<path className="m" d={g.marks} />
									{g.circle && (
										<circle className="m" cx={g.circle[0]} cy={g.circle[1]} r={g.circle[2]} />
									)}
									<text x={g.label[0]} y={g.label[1]}>
										{c.name}
									</text>
								</a>
							);
						})}
						<g className="plan__fixed">
							<rect x="0" y="450" width="500" height="110" />
							<text x="24" y="514">
								Clubhouse and desk
							</text>
							<rect x="1104" y="450" width="208" height="110" />
							<text x="1128" y="514">
								Way in
							</text>
						</g>
					</svg>
				</div>
				<ul className="plan__legend" aria-label="Key">
					<li>
						<i className="k k--free" aria-hidden="true" />
						Free at your hour
					</li>
					<li>
						<i className="k k--taken" aria-hidden="true" />
						Taken
					</li>
					<li>
						<i className="k k--pick" aria-hidden="true" />
						Your pick
					</li>
				</ul>
			</div>
		</section>
	);
}

const GAMES = [
	{
		id: "tennis",
		name: "Tennis",
		facts: [
			["Courts", "1 to 5, clay"],
			["Book for", "One hour or ninety minutes"],
			["Players", "Singles or doubles"],
			["Bring", "Your racket, or hire one at the desk"],
		],
	},
	{
		id: "padel",
		name: "Padel",
		facts: [
			["Courts", "Padel A and B, glass walls"],
			["Book for", "Ninety minutes"],
			["Players", "Four, always doubles"],
			["Bring", "Clean soles; balls at the desk"],
		],
	},
	{
		id: "five",
		name: "Five-a-side",
		facts: [
			["Pitch", "One floodlit pitch, artificial grass"],
			["Book for", "One hour"],
			["Players", "Two teams of five"],
			["Bring", "Moulded studs or trainers"],
		],
	},
] as const;

/** The three games, a switcher on the red field; arrow keys move between tabs. */
export function Games() {
	const [active, setActive] = useState<string>(GAMES[0].id);
	const tabs = useRef<(HTMLButtonElement | null)[]>([]);

	function onKey(e: KeyboardEvent, i: number) {
		const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
		if (!step) return;
		const next = (i + step + GAMES.length) % GAMES.length;
		setActive(GAMES[next]?.id ?? GAMES[0].id);
		tabs.current[next]?.focus();
	}

	return (
		<section className="games field--mark" aria-labelledby="games-title">
			<div className="container">
				<h2 id="games-title">Three games, one booking.</h2>
				<div className="switch">
					<div className="tabs" role="tablist" aria-label="Sport">
						{GAMES.map((g, i) => (
							<button
								key={g.id}
								ref={(el) => {
									tabs.current[i] = el;
								}}
								type="button"
								role="tab"
								id={`tab-${g.id}`}
								aria-selected={active === g.id}
								aria-controls={`p-${g.id}`}
								tabIndex={active === g.id ? 0 : -1}
								onClick={() => setActive(g.id)}
								onKeyDown={(e) => onKey(e, i)}
							>
								{g.name}
							</button>
						))}
					</div>
					{GAMES.map((g) => (
						<section
							key={g.id}
							className="panel"
							role="tabpanel"
							id={`p-${g.id}`}
							aria-labelledby={`tab-${g.id}`}
							hidden={active !== g.id}
						>
							<p className="panel__name" aria-hidden="true">
								{g.name}
							</p>
							<dl className="panel__facts">
								{g.facts.map(([dt, dd]) => (
									<div key={dt}>
										<dt>{dt}</dt>
										<dd>{dd}</dd>
									</div>
								))}
							</dl>
						</section>
					))}
				</div>
			</div>
		</section>
	);
}

const WEEK = [
	["Monday", "Junior tennis", "Padel, first steps", "Cardio tennis"],
	["Tuesday", "Junior tennis", "Women’s padel", "Five-a-side league"],
	["Wednesday", "Mini tennis", "Tennis, improvers", "Padel, match play"],
	["Thursday", "Junior tennis", "Padel, first steps", "Five-a-side league"],
	["Saturday", "Mini tennis", "Family padel", "Club night"],
] as const;

export function Coaching() {
	return (
		<section className="coaching" id="coaching" aria-labelledby="coaching-title">
			<div className="container coaching__grid">
				<div className="coaching__head">
					<h2 id="coaching-title">Coaching from five till seven.</h2>
					<p className="lead">Groups by level; ask at the desk for one-to-one.</p>
				</div>
				<table className="week">
					<caption className="visually-hidden">Weekly coaching sessions</caption>
					<thead>
						<tr>
							<th scope="col">Day</th>
							<th scope="col">17:00</th>
							<th scope="col">18:00</th>
							<th scope="col">19:00</th>
						</tr>
					</thead>
					<tbody>
						{WEEK.map(([day, ...sessions]) => (
							<tr key={day}>
								<th scope="row">{day}</th>
								{sessions.map((s, i) => (
									<td key={`${day} ${["17:00", "18:00", "19:00"][i]}`}>{s}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

export function Visit() {
	const { freeToday, days, choose } = useBooking();
	const today = days[0];
	return (
		<section className="visit" id="visit" aria-labelledby="visit-title">
			<div className="container visit__grid">
				<div className="visit__text">
					<h2 id="visit-title">Where to find the clay.</h2>
					<dl className="visit__facts">
						<div>
							<dt>Open</dt>
							<dd>
								<span className="fill" data-fill="hours">
									Opening hours to be added
								</span>
							</dd>
						</div>
						<div>
							<dt>Address</dt>
							<dd>
								<span className="fill" data-fill="address">
									Street address to be added
								</span>
							</dd>
						</div>
					</dl>
					<div className="visit__next">
						<h3>Free today</h3>
						<ul className="next">
							{freeToday.map(({ hour, court }: { hour: Hour; court: (typeof COURTS)[number] }) => (
								<li key={hour}>
									{/* biome-ignore lint/a11y/useValidAnchor: a real link to the booker (#book) that also sets day, hour and court */}
									<a
										className="next__slot"
										href="#book"
										onClick={() => today && choose(today.date, hour, court.id)}
									>
										{hour}, {court.short}
									</a>
								</li>
							))}
						</ul>
					</div>
				</div>
				<figure
					className="visit__photo"
					data-slot="pitch-photo"
					data-alt="The way in or the pitch at dusk, portrait"
				>
					<img
						src="/images/goal.jpg"
						width={1920}
						height={1920}
						loading="lazy"
						alt="A netted goal on the five-a-side pitch"
						style={{ objectPosition: "50% 45%" }}
					/>
				</figure>
			</div>
		</section>
	);
}

/** The sticky booking bar: hidden while the hero is on screen. */
export function BookingBar() {
	const { day, hour, court } = useBooking();
	const [hidden, setHidden] = useState(true);
	useEffect(() => {
		const hero = document.querySelector(".hero");
		if (!hero) return;
		const io = new IntersectionObserver(([e]) => setHidden(Boolean(e?.isIntersecting)), {
			threshold: 0,
		});
		io.observe(hero);
		return () => io.disconnect();
	}, []);
	return (
		<div className={hidden ? "bar is-hidden" : "bar"}>
			<div className="container bar__inner">
				<p className="bar__pick">
					<output>
						{day.label} at {hour}, {court ? court.short : "every court taken"}
					</output>
				</p>
				<a className="btn" href="#book">
					Book this court
				</a>
			</div>
		</div>
	);
}

export function Footer() {
	return (
		<footer className="foot">
			<div className="container foot__inner">
				<p className="foot__mark">Eastfield Courts</p>
				<p className="foot__col">
					Tennis, padel and five-a-side, booked by the hour.{" "}
					<a className="link" href="#book">
						Book
					</a>
					,{" "}
					<a className="link" href="#plan">
						the site plan
					</a>
					,{" "}
					<a className="link" href="#coaching">
						coaching
					</a>{" "}
					or{" "}
					<a className="link" href="#visit">
						how to find us
					</a>
					.
				</p>
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
