// Saves the built app's pages as static files in dist/snapshot/, for showing the design where no Worker runs
// (the Claude artifact viewer, a static host): "/" as index.html, every other page as <name>.html. It starts
// `vite preview` on the production build, fetches each server-rendered page, copies the client assets beside
// them and makes their paths relative. Each page still hydrates, so the booker, the site plan and the switcher
// work; a link to another page loads that page's file; anything that needs the server does not.
//
// Run after `aube run build`: aube run snapshot
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { routePaths } from "./routes.mjs";

const PORT = 4712;
const out = "dist/snapshot";
const preview = spawn("vite", ["preview", "--port", String(PORT), "--strictPort"], {
	stdio: "inherit",
});

try {
	const fetchPage = (path) =>
		fetch(`http://localhost:${PORT}${path}`)
			.then((r) => (r.ok ? r.text() : undefined))
			.catch(() => undefined);
	let ready;
	for (let i = 0; i < 60 && !ready; i++) {
		await new Promise((r) => setTimeout(r, 500));
		ready = await fetchPage("/");
	}
	if (!ready) throw new Error("vite preview never answered");

	rmSync(out, { recursive: true, force: true });
	mkdirSync(out, { recursive: true });
	cpSync("dist/client", out, { recursive: true });

	// Every page the router has (its generated route tree), each to its own file.
	const paths = routePaths();
	const file = (path) => (path === "/" ? "index.html" : `${path.slice(1)}.html`);
	const files = Object.fromEntries(paths.map((path) => [path, file(path)]));

	for (const path of paths) {
		const html = await fetchPage(path);
		if (!html) throw new Error(`vite preview gave nothing for ${path}`);
		// The router reads the page's path: wherever the snapshot is served from, it starts at this page's path.
		// A <base> at the folder it was served from keeps the relative asset paths working after that. A click on
		// a link to another page (before React sees it) loads that page's file, with its query.
		const boot = `<script>{const F=${JSON.stringify(files)};const d=location.pathname.replace(/[^/]*$/,'');const b=document.createElement('base');b.href=location.origin+d;document.head.prepend(b);history.replaceState(null,'',${JSON.stringify(path)}+location.search+location.hash);document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(!a||e.button||e.metaKey||e.ctrlKey)return;const u=new URL(a.getAttribute('href'),location.origin+'/');if(u.origin!==location.origin)return;const f=F[u.pathname];if(!f||(u.pathname===location.pathname&&u.hash))return;e.preventDefault();e.stopPropagation();location.href=b.href+f+u.search+u.hash},true)}</script>`;
		writeFileSync(
			join(out, files[path]),
			html
				.replaceAll('"/assets/', '"./assets/')
				.replaceAll('"/images/', '"./images/')
				.replaceAll('"/favicon.svg"', '"./favicon.svg"')
				.replace("<head>", `<head>${boot}`),
		);
	}

	// Inside the assets folder, a stylesheet's url(/assets/x) is its sibling.
	for (const name of readdirSync(join(out, "assets"))) {
		const file = join(out, "assets", name);
		if (name.endsWith(".css"))
			writeFileSync(file, readFileSync(file, "utf8").replaceAll("/assets/", "./"));
		// The router's manifest names assets from the root ("/assets/x"); the page's <base> resolves "./assets/x".
		if (name.endsWith(".js")) {
			let js = readFileSync(file, "utf8");
			for (const q of ['"', "'", "`"])
				js = js
					.replaceAll(`${q}/assets/`, `${q}./assets/`)
					.replaceAll(`${q}/favicon.svg${q}`, `${q}./favicon.svg${q}`);
			// Vite's preload helper loads split chunks from the root ("/" + "assets/x.js"), resolved against its own module in assets/; "../" lands on the snapshot folder.
			js = js.replace(/(`modulepreload`,[\w$]+=function\(e\)\{return)`\/`\+e\}/, "$1`../`+e}");
			writeFileSync(file, js);
		}
	}
	console.log(`snapshot written to ${out}/: ${Object.values(files).join(", ")}`);
} finally {
	preview.kill();
}
