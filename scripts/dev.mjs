// mise run all:dev: development, the same pair as staging and production, on this machine: Gateweave ID and courts, each
// a Worker in workerd through Cloudflare's Vite plugin, with its own local D1, Durable Objects and secrets, courts
// signing in through that ID only, and both on the internet through Tailscale Funnel (scripts/tailscale.mjs), so the
// site running here, on a Mac or in a cloud session alike, is opened in any browser with sign-in working. Nothing here
// reaches Cloudflare.
//
// Each step is what that project documents for itself, and the registration is the one app:register does on
// Cloudflare (scripts/app-register.mjs):
//   1. ID's pinned release (fetchId), set up by ID's own `dev:setup` (its README, "Running it locally"): .dev.vars with
//      fresh secrets, its OIDC provider on, email on but never sent (each email is a file under
//      vendor/gateweave-id/apps/web/.wrangler/tmp/email; ID prints its path), its local D1 migrated. Then courts' own
//      `dev:setup`: .dev.vars with a random BETTER_AUTH_SECRET, its local D1 migrated.
//   2. Tailscale (tailscale:login's steps): two machines signed in, one per Worker, each with Funnel on 443, each a
//      browser link that is waited for: courts on https://hallmark-stack-<host>.<tailnet>.ts.net, ID on
//      https://hallmark-stack-id-<host>.<tailnet>.ts.net (.tailscale/origins.json), development's addresses from then
//      on (scripts/environments.mjs).
//   3. Each side's own address in its .dev.vars, BETTER_AUTH_URL: ID's is its issuer (ID's .dev.vars.example: "its
//      origin is the issuer"), courts' its callback base.
//   4. app:register's register(): courts' client in ID's local D1 for courts' address, its settings in courts'
//      .dev.vars. Before courts starts, so it starts with them.
//   5. Both on their LOCAL ports, output prefixed [id] and [courts], each allowed to answer on their Funnel names
//      (Vite's __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS), each with its own `dev` and live reload on Funnel's 443 (ID's
//      own Vite config through scripts/id-vite.config.mjs, never edited);
//      then app:register's prove(), over the internet: courts' sign-in reaches ID's login page. Ctrl-C stops both.
//
//   6. id:claim's steps for development: a new local ID waits for you to Create account, its code printed here.
// Both .dev.vars and .tailscale/ are git-ignored and never leave the machine (README, Secrets).
import { execFileSync, spawn } from "node:child_process";
import { delimiter, join, resolve } from "node:path";
import { prove, register, setDevVars } from "./app-register.mjs";
import { chooseEnvironment, DEVELOPMENT, LOCAL } from "./environments.mjs";
import { fetchId, ID_ROOT, ID_WEB } from "./id-release.mjs";
import { tailscaleUp } from "./tailscale.mjs";

process.argv[2] = DEVELOPMENT;
const env = chooseEnvironment({ development: true });

// ID's scripts run with ID's own packages on the PATH, as its package scripts would.
const idEnv = {
	...process.env,
	PATH: [resolve(ID_WEB, "node_modules/.bin"), process.env.PATH].join(delimiter),
};

// 1. Each set up its own way.
fetchId();
execFileSync("node", ["scripts/dev-setup.mjs"], { cwd: ID_WEB, env: idEnv, stdio: "inherit" });
execFileSync("node", ["scripts/dev-setup.mjs"], { stdio: "inherit" });

// 2. On the internet.
const origins = await tailscaleUp();

// 3. Each side's own address.
setDevVars(join(ID_ROOT, ".dev.vars"), { BETTER_AUTH_URL: origins.id });
setDevVars(".dev.vars", { BETTER_AUTH_URL: origins.app });

// 4. courts registered with this ID, for courts' address.
await register(env);

// 5. Both, side by side.
const children = [];
function run(name, args, options = {}) {
	const child = spawn("vite", args, {
		...options,
		env: {
			...(options.env ?? process.env),
			__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: origins.hosts.join(","),
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	for (const stream of [child.stdout, child.stderr]) {
		let rest = "";
		stream.on("data", (chunk) => {
			const lines = (rest + chunk).split("\n");
			rest = lines.pop() ?? "";
			for (const line of lines) console.log(`[${name}] ${line}`);
		});
	}
	child.on("exit", (code) => {
		console.log(`[${name}] stopped (${code ?? "signal"})`);
		stop(code ?? 0);
	});
	children.push(child);
}
function stop(code) {
	for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
	process.exitCode ||= code;
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// Each with its own `dev` on its LOCAL port, live reload on Funnel's 443: ID's through scripts/id-vite.config.mjs (its
// own Vite config, unchanged, plus that one setting), courts' through its vite.config.ts (DEV_HMR_CLIENT_PORT).
run(
	"id",
	[
		"dev",
		"--config",
		resolve("scripts/id-vite.config.mjs"),
		"--port",
		new URL(LOCAL.id).port,
		"--strictPort",
	],
	{ cwd: ID_WEB, env: { ...idEnv, DEV_HMR_CLIENT_PORT: "443" } },
);
run("courts", ["dev", "--port", new URL(LOCAL.app).port, "--strictPort"], {
	env: { ...process.env, DEV_HMR_CLIENT_PORT: "443" },
});

try {
	await prove(env);
	// A new local ID is claimed by you, as id:deploy has id:claim do on Cloudflare: it waits for your Create account.
	// Not execFileSync: this process keeps relaying both servers' output while it waits.
	const claimed = await new Promise((done) =>
		spawn("node", ["scripts/id-claim.mjs", DEVELOPMENT], { stdio: "inherit" }).on("exit", done),
	);
	if (claimed !== 0) throw new Error("Gateweave ID wasn't claimed (mise run id:claim development)");
	console.log(
		`\nDevelopment is up, from any browser:\n  courts        ${origins.app}\n  Gateweave ID  ${origins.id}\nCtrl-C stops both.\n`,
	);
} catch (error) {
	console.error(error.message);
	stop(1);
}
