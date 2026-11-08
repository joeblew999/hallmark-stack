// The site's pages: one list, read by the header's nav and the footer, so a page added here is on every page, and by
// Hallmark's lint (e2e/hallmark.spec.ts), which judges every route at its scope and fails on a route not listed here.
// DESIGN.md (Pages) says this is the list; `mise run hallmark:page` tells Hallmark to add each new page to it.
// Each page has one job. Signed-in screens (/bookings) and the sign-in page (/login) are not in the nav: the
// header's account side links to them.
//
// Scope is Hallmark's (references/flow.md): "page" is read, with the marketing gates; "app" is worked in (a tool, a
// form, behind a sign-in), with the app gates (`sloplint --scope app`).

export type Scope = "page" | "app";

export interface Page {
	/** The route, as TanStack Router knows it. */
	to: "/book" | "/courts" | "/coaching" | "/visit";
	/** Its name in the nav and the footer. */
	label: string;
	/** Its one job, said on the home page beside the link. */
	job: string;
	scope: Scope;
}

export const PAGES: readonly Page[] = [
	{ to: "/book", label: "Book", job: "Pick a day, an hour and a court.", scope: "app" },
	{ to: "/courts", label: "Courts", job: "The site plan, and each game.", scope: "page" },
	{ to: "/coaching", label: "Coaching", job: "Group sessions, five till seven.", scope: "page" },
	{ to: "/visit", label: "Visit", job: "Hours, address, and what’s free.", scope: "page" },
];

/** Every route's Hallmark scope: the nav's pages, and the ones outside the nav. */
export const SCOPES: Record<string, Scope> = {
	"/": "page",
	...Object.fromEntries(PAGES.map((p) => [p.to, p.scope])),
	"/bookings": "app",
	"/login": "app",
};
