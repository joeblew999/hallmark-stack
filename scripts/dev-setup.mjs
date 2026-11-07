// One-time local setup: .dev.vars with a random BETTER_AUTH_SECRET (kept if it exists), then the local D1 migrated.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".dev.vars")) console.log(".dev.vars exists; keeping it.");
else {
	writeFileSync(".dev.vars", `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}\n`);
	console.log("wrote .dev.vars with a random BETTER_AUTH_SECRET");
}
execFileSync("wrangler", ["d1", "migrations", "apply", "DB", "--local"], { stdio: "inherit" });
