// mise run id:check and id:update: is Gateweave ID's pin in scripts/id-release.mjs behind its newest release, and
// moving it there. Uses git only (ls-remote and fetch), so it works on a Mac and in a cloud session with no login.
//
//   check   lists each newer release, with its page (the release notes), and says if it adds database migrations
//   update  writes the newest release and its commit into scripts/id-release.mjs, then fetches it
//
// After update: mise run test, mise run all:dev and mise run all:e2e development, then commit. Staging and production
// get it from mise run id:deploy <env>.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fetchId, ID_COMMIT, ID_RELEASE, ID_ROOT } from "./id-release.mjs";

const REPO = "https://github.com/gateweavehq/id";
const PIN_FILE = "scripts/id-release.mjs";

/** Every release tag and the commit it names, oldest first. */
function releases() {
	const lines = execFileSync("git", ["ls-remote", "--tags", REPO], { encoding: "utf8" })
		.trim()
		.split("\n");
	const commits = new Map();
	for (const line of lines) {
		const [commit, ref] = line.split("\t");
		const tag = ref.replace("refs/tags/", "");
		if (tag.endsWith("^{}")) commits.set(tag.slice(0, -3), commit);
		else if (!commits.has(tag)) commits.set(tag, commit);
	}
	const version = (tag) => tag.slice(1).split(".").map(Number);
	const older = (a, b) => {
		const [x, y] = [version(a), version(b)];
		for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
		return 0;
	};
	return [...commits]
		.filter(([tag]) => /^v\d+\.\d+\.\d+$/.test(tag))
		.sort(([a], [b]) => older(a, b))
		.map(([tag, commit]) => ({ tag, commit }));
}

/** The releases after the pinned one. */
function newer() {
	const all = releases();
	const at = all.findIndex((release) => release.tag === ID_RELEASE);
	if (at < 0) throw new Error(`${ID_RELEASE} is no longer a tag of ${REPO}`);
	return all.slice(at + 1);
}

/** The migration files a release adds to the pinned one, read by fetching it into vendor/gateweave-id. */
function addedMigrations(tag) {
	fetchId();
	execFileSync("git", ["fetch", "--depth", "1", "origin", "tag", tag, "--no-tags"], {
		cwd: ID_ROOT,
		stdio: "ignore",
	});
	return execFileSync(
		"git",
		["diff", "--name-only", "--diff-filter=A", "HEAD", tag, "--", "apps/web/migrations"],
		{ cwd: ID_ROOT, encoding: "utf8" },
	)
		.trim()
		.split("\n")
		.filter(Boolean);
}

function check() {
	const ahead = newer();
	if (ahead.length === 0) {
		console.log(`Gateweave ID ${ID_RELEASE} is the newest release.`);
		return;
	}
	console.log(
		`Gateweave ID is pinned at ${ID_RELEASE}. Newer releases (read each one's notes before updating):`,
	);
	for (const { tag } of ahead) console.log(`  ${tag}  ${REPO}/releases/tag/${tag}`);
	const newest = ahead.at(-1).tag;
	const migrations = addedMigrations(newest);
	console.log(
		migrations.length === 0
			? `No new database migrations up to ${newest}.`
			: `New database migrations up to ${newest} (ID's deploy applies them):\n${migrations.map((file) => `  ${file}`).join("\n")}`,
	);
	console.log("To move to the newest: mise run id:update");
	process.exitCode = 1;
}

function update() {
	const ahead = newer();
	if (ahead.length === 0) {
		console.log(`Gateweave ID ${ID_RELEASE} is already the newest release.`);
		return;
	}
	const { tag, commit } = ahead.at(-1);
	const today = new Date().toISOString().slice(0, 10);
	const source = readFileSync(PIN_FILE, "utf8")
		.replace(/the newest on \d{4}-\d{2}-\d{2}/, `the newest on ${today}`)
		.replace(`ID_RELEASE = "${ID_RELEASE}"`, `ID_RELEASE = "${tag}"`)
		.replace(`ID_COMMIT = "${ID_COMMIT}"`, `ID_COMMIT = "${commit}"`);
	writeFileSync(PIN_FILE, source);
	console.log(`Gateweave ID ${ID_RELEASE} -> ${tag} (commit ${commit}) in ${PIN_FILE}.`);
	execFileSync("node", ["-e", "import('./scripts/id-release.mjs').then((m) => m.fetchId())"], {
		stdio: "inherit",
	});
	console.log(
		"Next: mise run test, mise run all:dev and mise run all:e2e development, then commit. Deploy with mise run id:deploy <env>.",
	);
}

if (process.argv[2] === "check") check();
else if (process.argv[2] === "update") update();
