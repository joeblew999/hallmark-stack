// aube run config:check, in aube run ci: every deployable environment's config is whole, before anything is built or
// deployed. Wrangler doesn't inherit bindings, vars or secrets into an environment, and a block missing one only
// warns, so this reads each environment back as Wrangler will (unstable_readConfig, no build, no login) and says
// exactly what is missing. courts: wrangler.jsonc. Gateweave ID: our values in id.jsonc (scripts/id-deploy.mjs writes
// them into ID's own wrangler.jsonc).
import { existsSync } from "node:fs";
import { experimental_readRawConfig, unstable_readConfig } from "wrangler";
import { ENVIRONMENTS, LOCATION } from "./environments.mjs";

const problems = [];
const need = (ok, what) => {
	if (!ok) problems.push(what);
};

// A missing environment only warns, and Wrangler hands back the top level, which would pass these checks.
const courts = experimental_readRawConfig({ config: "wrangler.jsonc" }).rawConfig;
for (const env of ENVIRONMENTS) {
	const at = `wrangler.jsonc env.${env}`;
	if (!courts.env?.[env]) {
		problems.push(`${at}: missing`);
		continue;
	}
	const c = unstable_readConfig({ config: "wrangler.jsonc", env });
	need(
		c.name === `courts-${env}`,
		`${at}: Worker "courts-${env}" (Wrangler's own {name}-{env}), not "${c.name}"`,
	);
	const domains = (c.routes ?? []).filter((r) => typeof r === "object" && r.custom_domain);
	need(domains.length === 1, `${at}: exactly one Custom Domain in routes`);
	const db = c.d1_databases.find((d) => d.binding === "DB");
	need(db?.database_name === `courts-${env}`, `${at}: D1 "DB" named "courts-${env}"`);
	const objects = c.durable_objects.bindings.map((b) => `${b.name}:${b.class_name}`);
	for (const o of ["VENUE:VenueDO", "RATE_LIMITER:RateLimiter"])
		need(objects.includes(o), `${at}: Durable Object ${o}`);
	need(
		c.secrets?.required?.includes("BETTER_AUTH_SECRET"),
		`${at}: secrets.required with BETTER_AUTH_SECRET`,
	);
	need(c.vars?.LOCATION === LOCATION, `${at}: vars.LOCATION "${LOCATION}"`);
	need(c.observability?.traces?.enabled === true, `${at}: observability.traces.enabled`);
	need((c.triggers?.crons ?? []).length > 0, `${at}: the daily cron`);
}

// id.jsonc isn't a whole Worker config (ID's bindings come from ID's own file), so it's read raw.
const id = existsSync("id.jsonc")
	? experimental_readRawConfig({ config: "id.jsonc" }).rawConfig
	: {};
need(existsSync("id.jsonc"), "id.jsonc: missing");
for (const env of ENVIRONMENTS) {
	const e = id.env?.[env] ?? {};
	const at = `id.jsonc env.${env}`;
	const domain = e.routes?.[0]?.pattern;
	need(
		e.routes?.length === 1 && e.routes[0].custom_domain,
		`${at}: exactly one Custom Domain in routes`,
	);
	need(
		e.vars?.BETTER_AUTH_URL === `https://${domain}`,
		`${at}: vars.BETTER_AUTH_URL "https://<its domain>"`,
	);
	need(Boolean(e.vars?.EMAIL_FROM), `${at}: vars.EMAIL_FROM`);
	need(e.vars?.CHECK_BREACHED_PASSWORDS === "1", `${at}: vars.CHECK_BREACHED_PASSWORDS "1"`);
}

if (problems.length) {
	console.error(`Config isn't whole for every environment:\n  - ${problems.join("\n  - ")}`);
	process.exit(1);
}
console.log(
	`Config whole for ${ENVIRONMENTS.join(" and ")}: courts (wrangler.jsonc) and Gateweave ID (id.jsonc).`,
);
