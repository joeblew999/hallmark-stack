import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** The plain bar for pages without the booker: the wordmark and one action. */
export function PlainNav({ action }: { action: ReactNode }) {
	return (
		<header className="nav">
			<div className="container nav__inner nav__inner--plain">
				<Link className="wordmark" to="/" aria-label="Eastfield Courts, home">
					<span>Eastfield</span>
					<span>Courts</span>
				</Link>
				{action}
			</div>
		</header>
	);
}
