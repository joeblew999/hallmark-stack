// Cloudflare login for this repo with Wrangler's device-code flow (`wrangler login --device`, RFC 8628), which works
// where Wrangler's usual localhost callback can't: a container, an SSH session, a Claude cloud session. It prints the
// verify link with the code on it, one click to approve. Already logged in: it says as whom and stops.
// Verified 2026-11-07 with wrangler 4.156.0: the ?user_code= link opens Cloudflare's approval with the code filled in.
// Run: mise run cloudflare:login
import { spawn, spawnSync } from "node:child_process";

/** Who Wrangler is logged in as: the email and account lines of `wrangler whoami`, or null. */
function whoami() {
	const out = spawnSync("wrangler", ["whoami"], { encoding: "utf8" }).stdout ?? "";
	if (/not authenticated/i.test(out)) return null;
	const email = /associated with the email (\S+?)\.?\s*$/m.exec(out)?.[1];
	const account = /│\s*(.+?)\s*│\s*([0-9a-f]{32})\s*│/.exec(out);
	return email ? `${email}${account ? `, account ${account[1]} (${account[2]})` : ""}` : null;
}

const already = whoami();
if (already) {
	console.log(`Already logged in to Cloudflare as ${already}.`);
	process.exit(0);
}

const login = spawn("wrangler", ["login", "--device", "--browser=false"], {
	stdio: ["inherit", "pipe", "inherit"],
});
let text = "";
let shown = false;
login.stdout.on("data", (chunk) => {
	text += chunk.toString();
	const url = /(https:\/\/\S+\/oauth2\/device\/verify)/.exec(text)?.[1];
	const code = /enter the code:\s*(\S+)/.exec(text)?.[1];
	if (url && code && !shown) {
		shown = true;
		console.log(
			`\nApprove this repo's Cloudflare login (5 minutes):\n\n  ${url}?user_code=${encodeURIComponent(code)}\n`,
		);
	}
});
login.on("exit", (status) => {
	const who = whoami();
	if (status === 0 && who) console.log(`Logged in to Cloudflare as ${who}.`);
	else console.error("The Cloudflare login didn't complete: run mise run cloudflare:login again.");
	process.exit(status === 0 && who ? 0 : 1);
});
