// mise run all:dev: development, the same pair as staging and production, on this machine: Gateweave ID and courts, each
// a Worker in workerd through Cloudflare's Vite plugin, with its own local D1, Durable Objects and secrets, courts
// signing in through that ID only, and both on the internet through Tailscale Funnel (scripts/tailscale.mjs), so the
// site running here, on a Mac or in a cloud session alike, is opened in any browser with sign-in working. Nothing here
// reaches Cloudflare.
//
//   1. ID's pinned release (fetchId), set up by ID's own `dev:setup` (its README, "Running it locally"); then courts'
//      own `dev:setup`. Each writes its .dev.vars and migrates its local D1.
//   2. Tailscale (tailscale:login's steps): both on public https addresses (.tailscale/origins.json).
//   3. Each side's own address in its .dev.vars (BETTER_AUTH_URL).
//   4. app:register's register(): courts' client in ID's local D1 for courts' address, its settings in courts' .dev.vars.
//   5. Both dev servers (re)started as mise daemons, [daemons.id] and [daemons.courts] in mise.toml, so they run in the
//      background and pick up step 3 and 4's settings; mise waits until each answers. Then app:register's prove():
//      courts' sign-in reaches ID's login page over the internet.
//   6. id:claim's steps for development: a new local ID waits for you to Create account, its code printed here.
// This command then ends; the servers keep running. mise daemons logs id / courts shows their output, mise daemons stop
// stops them. Both .dev.vars and .tailscale/ are git-ignored and never leave the machine (README, Secrets).
import { execFileSync } from "node:child_process";
import { delimiter, join, resolve } from "node:path";
import { prove, register, setDevVars } from "./app-register.mjs";
import { chooseEnvironment, DEVELOPMENT } from "./environments.mjs";
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

// 5. Both servers, as mise daemons, restarted so they read the settings above; mise waits until each is ready.
execFileSync("mise", ["daemons", "restart"], { stdio: "inherit" });
await prove(env);

// 6. A new local ID is claimed by you, as id:deploy has id:claim do on Cloudflare.
execFileSync("node", ["scripts/id-claim.mjs", DEVELOPMENT], { stdio: "inherit" });

console.log(`
Development is up, from any browser:
  courts        ${origins.app}
  Gateweave ID  ${origins.id}
They keep running. Their output: mise daemons logs id, mise daemons logs courts. Stop them: mise daemons stop.
`);
