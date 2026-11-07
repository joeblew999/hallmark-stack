// Saves the built app's home page as static files in dist/snapshot/, for showing the design where no Worker runs
// (the Claude artifact viewer, a static host). It starts `vite preview` on the production build, fetches the
// server-rendered page, copies the client assets beside it and makes their paths relative. The page still
// hydrates, so the booker, the site plan and the switcher work; anything that needs the server does not.
//
// Run after `aube run build`: aube run snapshot
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = 4712;
const out = "dist/snapshot";
const preview = spawn("vite", ["preview", "--port", String(PORT), "--strictPort"], { stdio: "inherit" });

try {
	let html;
	for (let i = 0; i < 60 && !html; i++) {
		await new Promise((r) => setTimeout(r, 500));
		html = await fetch(`http://localhost:${PORT}/`)
			.then((r) => (r.ok ? r.text() : undefined))
			.catch(() => undefined);
	}
	if (!html) throw new Error("vite preview never answered");

	rmSync(out, { recursive: true, force: true });
	mkdirSync(out, { recursive: true });
	cpSync("dist/client", out, { recursive: true });

	// The router reads the page's path: wherever the snapshot is served from, it starts at "/".
	// A <base> at the folder it was served from keeps the relative asset paths working after that.
	const toRoot =
		"<script>{const d=location.pathname.replace(/[^/]*$/,'');const b=document.createElement('base');b.href=location.origin+d;document.head.prepend(b);if(location.pathname!=='/')history.replaceState(null,'','/'+location.search+location.hash)}</script>";
	writeFileSync(join(out, "index.html"), html.replaceAll('"/assets/', '"./assets/').replaceAll('"/images/', '"./images/').replaceAll('"/favicon.svg"', '"./favicon.svg"').replace("<head>", `<head>${toRoot}`));

	// Inside the assets folder, a stylesheet's url(/assets/x) is its sibling.
	for (const name of readdirSync(join(out, "assets"))) {
		const file = join(out, "assets", name);
		if (name.endsWith(".css")) writeFileSync(file, readFileSync(file, "utf8").replaceAll("/assets/", "./"));
		// The router's manifest names assets from the root ("/assets/x"); the page's <base> resolves "./assets/x".
		if (name.endsWith(".js")) {
			let js = readFileSync(file, "utf8");
			for (const q of ['"', "'", "`"]) js = js.replaceAll(`${q}/assets/`, `${q}./assets/`).replaceAll(`${q}/favicon.svg${q}`, `${q}./favicon.svg${q}`);
			writeFileSync(file, js);
		}
	}
	console.log(`snapshot written to ${out}/`);
} finally {
	preview.kill();
}
