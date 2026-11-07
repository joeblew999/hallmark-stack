import { type FormEvent, useState } from "react";
import { COURTS, HOURS, type Hour } from "#/lib/courts";
import { useBooking } from "./booking";

/**
 * The hero's booker on the ultramarine field: the chosen hour at poster scale, then day, start time and court.
 * `onBook` sends the booking; it resolves to the line shown under the button.
 */
export function Booker({ onBook }: { onBook: (courtId: string, date: string, hour: Hour) => Promise<string> }) {
	const { days, day, hour, court, setDay, setHour, pick, isTaken } = useBooking();
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!court) return;
		setBusy(true);
		try {
			setMessage(await onBook(court.id, day.date, hour));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div
			className="booker"
			id="book"
			data-slot="booker"
			data-kind="product"
			data-alt="A screenshot of the live booking screen"
		>
			<form onSubmit={submit} onChange={() => setMessage("")} noValidate aria-label="Book a court">
				<div className="booker__when" aria-live="polite">
					<p className="booker__hour">
						<output>{hour}</output>
					</p>
					<p className="booker__day">
						<output>
							{day.label}, {court ? court.short : "no court free"}
						</output>
					</p>
				</div>

				<fieldset className="chips">
					<legend>Day</legend>
					{days.map((d) => (
						<span key={d.date}>
							<input
								type="radio"
								name="day"
								id={`d-${d.date}`}
								value={d.date}
								checked={d.date === day.date}
								onChange={() => setDay(d.date)}
							/>
							<label htmlFor={`d-${d.date}`}>{d.label}</label>
						</span>
					))}
				</fieldset>

				<fieldset className="chips">
					<legend>Start time</legend>
					{HOURS.map((h) => (
						<span key={h}>
							<input
								type="radio"
								name="time"
								id={`t-${h}`}
								value={h}
								checked={h === hour}
								onChange={() => setHour(h)}
							/>
							<label htmlFor={`t-${h}`}>{h}</label>
						</span>
					))}
				</fieldset>

				<fieldset className="courts">
					<legend>Court</legend>
					<ul>
						{COURTS.map((c) => {
							const taken = isTaken(c.id);
							return (
								<li key={c.id}>
									<input
										type="radio"
										name="court"
										id={`c-${c.id}`}
										value={c.id}
										disabled={taken}
										checked={court?.id === c.id}
										onChange={() => pick(c.id)}
									/>
									<label htmlFor={`c-${c.id}`}>
										<b>{c.name}</b>
										<small>
											{c.sport}
											{taken ? ", taken" : ""}
										</small>
									</label>
								</li>
							);
						})}
					</ul>
				</fieldset>

				<div className="booker__go">
					<button className="btn" type="submit" disabled={!court || busy} aria-busy={busy}>
						{court ? `Book ${court.short} at ${hour}` : "Every court is taken"}
					</button>
					<p className="booker__msg" aria-live="polite">
						{message}
					</p>
				</div>
			</form>
		</div>
	);
}
