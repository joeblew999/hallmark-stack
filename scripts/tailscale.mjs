// Tailscale for development (mise run all:dev, tailscale:login, tailscale:logout): the local pair on public https
// addresses through Tailscale Funnel, the same on a Mac and in a cloud session, so the site running on any machine is
// opened in any browser, sign-in included. Pinned in mise.toml (tailscale, which brings tailscaled too).
//
// Two Tailscale machines, one per Worker, each published by Funnel on port 443:
//   courts        https://hallmark-stack-<host>.<tailnet>.ts.net      -> LOCAL.app (4710)
//   Gateweave ID  https://hallmark-stack-id-<host>.<tailnet>.ts.net   -> LOCAL.id  (4730)
// Funnel serves one site on 443 per machine, and both must be on 443: a Claude cloud session lets encrypted traffic
// out on 443 only, and courts' Worker there must reach ID (discovery, tokens), as it does on Cloudflare.
//
// This repo runs its own tailscaled for each, never the machine's: userspace networking (no root, no network device,
// as Tailscale documents for containers), each one's socket, state and log in the git-ignored .tailscale/<app|id>/, so
// nothing touches a Tailscale app the machine may already run. They go through HTTPS_PROXY where there is one (a cloud
// session), on 443.
//
// Signing in is Tailscale's browser link, once per machine name, like cloudflare:login: no key is stored anywhere but
// .tailscale/. Funnel asks once for approval, also a link. Each step prints its link and waits for it, so nobody has to
// say it's done. Where both are is written to .tailscale/origins.json, which development's addresses are read from
// (scripts/environments.mjs).
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { LOCAL, ORIGINS } from "./environments.mjs";

export const STATE = ".tailscale";
const HOST = hostname()
	.split(".")[0]
	.toLowerCase()
	.replace(/[^a-z0-9-]/g, "-");
/** The two machines: each one's name on the tailnet (Tailscale adds -1, -2 if taken) and the local port it publishes. */
const NODES = [
	{ key: "app", name: `hallmark-stack-${HOST}`.slice(0, 63), to: LOCAL.app, what: "courts" },
	{ key: "id", name: `hallmark-stack-id-${HOST}`.slice(0, 63), to: LOCAL.id, what: "Gateweave ID" },
];

const socketOf = (node) => `${STATE}/${node.key}/tailscaled.sock`;
const tailscale = (node, args, options = {}) =>
	spawnSync("tailscale", ["--socket", socketOf(node), ...args], { encoding: "utf8", ...options });

/** Tailscale's own view of one machine, or null when its tailscaled isn't running. */
function status(node) {
	try {
		return JSON.parse(tailscale(node, ["status", "--json"]).stdout);
	} catch {
		return null;
	}
}

/** One machine's tailscaled, started if it isn't running. */
async function daemon(node) {
	if (status(node)) return;
	const dir = `${STATE}/${node.key}`;
	mkdirSync(`${dir}/state`, { recursive: true });
	const log = openSync(`${dir}/tailscaled.log`, "a");
	spawn(
		"tailscaled",
		["--tun=userspace-networking", "--socket", socketOf(node), "--statedir", `${dir}/state`],
		{ detached: true, stdio: ["ignore", log, log] },
	).unref();
	for (let i = 0; i < 30 && !status(node); i++) await new Promise((done) => setTimeout(done, 500));
	if (!status(node)) throw new Error(`tailscaled didn't start: see ${dir}/tailscaled.log`);
}

/**
 * Both machines signed in, each with Funnel on 443 for its local port: the browser link to sign in and the one to
 * approve Funnel are printed and waited for (`tailscale up` and `tailscale funnel` both wait). Returns where each is,
 * and writes it to .tailscale/origins.json.
 */
export async function tailscaleUp() {
	const origins = {};
	for (const node of NODES) {
		await daemon(node);
		if (status(node)?.BackendState !== "Running") {
			console.log(
				`Sign ${node.name} (${node.what}) in to Tailscale: open the link below; this waits for it.`,
			);
			execFileSync("tailscale", ["--socket", socketOf(node), "up", "--hostname", node.name], {
				stdio: "inherit",
			});
		}
		execFileSync(
			"tailscale",
			[
				"--socket",
				socketOf(node),
				"funnel",
				"--bg",
				"--https=443",
				`http://localhost:${new URL(node.to).port}`,
			],
			{ stdio: "inherit" },
		);
		const host = status(node)?.Self?.DNSName?.replace(/\.$/, "");
		if (!host) throw new Error(`Tailscale gave ${node.name} no name`);
		origins[node.key] = { origin: `https://${host}`, host };
	}
	const result = {
		app: origins.app.origin,
		id: origins.id.origin,
		hosts: [origins.app.host, origins.id.host],
	};
	writeFileSync(ORIGINS, `${JSON.stringify(result, null, "\t")}\n`);
	return result;
}

/** Funnel off and signed out on both machines, their tailscaled stopped, and .tailscale/ gone. */
export function tailscaleDown() {
	for (const node of NODES) {
		if (!status(node)) continue;
		tailscale(node, ["funnel", "reset"], { stdio: "inherit" });
		tailscale(node, ["logout"], { stdio: "inherit" });
		spawnSync("pkill", ["-f", `tailscaled.*${socketOf(node)}`]);
	}
	rmSync(STATE, { recursive: true, force: true });
	console.log("Signed out of Tailscale here; .tailscale/ removed.");
}

// Run as the tasks: tailscale:login (up) and tailscale:logout (down).
if (process.argv[2] === "up") {
	const { app, id } = await tailscaleUp();
	console.log(`On the internet: courts ${app}, Gateweave ID ${id}`);
} else if (process.argv[2] === "down") {
	tailscaleDown();
}
