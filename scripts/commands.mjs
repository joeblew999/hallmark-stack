// mise run docs:update writes docs/commands.md in two parts:
//   - the mise tasks, written by mise itself (mise generate task-docs --inject) between <!-- mise-tasks --> markers;
//   - the app's package.json scripts, which mise doesn't document, written by this script between
//     <!-- app-scripts --> markers, from package.json's scripts and scriptsInfo (one plain line each).
// The README links to the file and CLAUDE.md imports it. mise run test fails if it is out of date (docs:check).
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "docs/commands.md";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const rows = Object.entries(pkg.scripts).map(([name, run]) => {
	const why = pkg.scriptsInfo?.[name];
	if (!why) throw new Error(`package.json scriptsInfo has no line for "${name}"`);
	return `| \`aube run ${name}\` | ${why} | \`${run.replaceAll("|", "\\|")}\` |`;
});
const table = ["| Command | What it's for | Runs |", "| --- | --- | --- |", ...rows].join("\n");
const doc = readFileSync(FILE, "utf8");
const start = "<!-- app-scripts -->";
const end = "<!-- /app-scripts -->";
if (!doc.includes(start) || !doc.includes(end))
	throw new Error(`${FILE} has no ${start} ... ${end} markers`);
writeFileSync(
	FILE,
	`${doc.slice(0, doc.indexOf(start) + start.length)}\n${table}\n${doc.slice(doc.indexOf(end))}`,
);
