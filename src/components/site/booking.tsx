import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { COURTS, type Court, type Day, HOURS, type Hour } from "#/lib/courts";

/** Which courts are taken, by `${date} ${hour}`: the court ids. */
export type Taken = Record<string, readonly string[]>;

interface Booking {
	days: Day[];
	day: Day;
	hour: Hour;
	court: Court | undefined;
	setDay: (date: string) => void;
	setHour: (hour: Hour) => void;
	/** Picks a court if it is free at the chosen time; returns whether it was. */
	pick: (courtId: string) => boolean;
	isTaken: (courtId: string, date?: string, hour?: Hour) => boolean;
	/** The first free court for each hour today, up to three. */
	freeToday: { hour: Hour; court: Court }[];
	/** Sets day, hour and court together (the free-today shortcuts). */
	choose: (date: string, hour: Hour, courtId: string) => void;
}

const BookingContext = createContext<Booking | null>(null);

export function useBooking(): Booking {
	const booking = useContext(BookingContext);
	if (!booking) throw new Error("useBooking outside <BookingProvider>");
	return booking;
}

export function BookingProvider({
	days,
	taken,
	initial,
	children,
}: {
	days: Day[];
	taken: Taken;
	/** What a link to the Book page picked: a day, an hour, a court (the site plan, Free today). */
	initial?: { date?: string; hour?: Hour; court?: string };
	children: ReactNode;
}) {
	const first = days[0] as Day;
	const [date, setDate] = useState(
		days.some((d) => d.date === initial?.date) ? (initial?.date as string) : first.date,
	);
	const [hour, setHourState] = useState<Hour>(initial?.hour ?? "19:00");
	const [courtId, setCourtId] = useState<string | undefined>(initial?.court);

	const value = useMemo<Booking>(() => {
		const day = days.find((d) => d.date === date) ?? first;
		const isTaken = (id: string, d = day.date, h = hour) => (taken[`${d} ${h}`] ?? []).includes(id);
		const firstFree = (d: string, h: Hour) => COURTS.find((c) => !isTaken(c.id, d, h));
		// The chosen court, or the first free one when it is taken (or nothing was chosen yet).
		const chosen = courtId && !isTaken(courtId) ? COURTS.find((c) => c.id === courtId) : undefined;
		const court = chosen ?? firstFree(day.date, hour);
		const freeToday = HOURS.flatMap((h) => {
			const c = firstFree(first.date, h);
			return c ? [{ hour: h, court: c }] : [];
		}).slice(0, 3);
		return {
			days,
			day,
			hour,
			court,
			setDay: setDate,
			setHour: setHourState,
			pick: (id) => {
				if (isTaken(id)) return false;
				setCourtId(id);
				return true;
			},
			isTaken,
			freeToday,
			choose: (d, h, id) => {
				setDate(d);
				setHourState(h);
				setCourtId(id);
			},
		};
	}, [days, first, date, hour, courtId, taken]);

	return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}
