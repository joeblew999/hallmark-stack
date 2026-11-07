import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Eastfield Courts: book tennis, padel and five-a-side by the hour" },
			{
				name: "description",
				content: "See which tennis, padel and five-a-side courts are free at Eastfield, choose an hour and book.",
			},
		],
		links: [{ rel: "stylesheet", href: appCss }],
		// Hallmark's no-script rule: content is visible without JavaScript; `.js` scopes what only script shows.
		scripts: [{ children: "document.documentElement.classList.add('js')" }],
	}),
	shellComponent: RootDocument,
	notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function NotFound() {
	return (
		<main id="main" className="container notfound">
			<h1>Not a court.</h1>
			<p className="lead">That page doesn’t exist.</p>
			<a className="link" href="/">
				Back to the booker
			</a>
		</main>
	);
}
