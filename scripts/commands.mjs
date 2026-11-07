// Writes docs/commands.md from package.json: every script, what it runs and what it is for (scriptsInfo). The
// README links to it and CLAUDE.md imports it, so the commands are listed in one place that can't drift.
// `--check` fails if the file is out of date (aube run ci does that first).
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const rows = Object.entries(pkg.scripts).map(([name, run]) => {
	const why = pkg.scriptsInfo?.[name];
	if (!why) throw new Error(`package.json scriptsInfo has no line for "${name}"`);
	return `| \`aube run ${name}\` | ${why} | \`${run.replaceAll("|", "\\|")}\` |`;
});
const doc = `# Commands

Generated from \`package.json\` by \`aube run commands\`; don't edit by hand. Tools are pinned in \`mise.toml\`
(\`mise install\`), packages installed with \`aube install\`. With mise activated in your shell, \`aube\` is on the
path; otherwise prefix \`mise exec --\`.

| Command | What it's for | Runs |
| --- | --- | --- |
${rows.join("\n")}
`;
if (process.argv.includes("--check")) {
	let current = "";
	try {
		current = readFileSync("docs/commands.md", "utf8");
	} catch {}
	if (current !== doc) {
		console.error("docs/commands.md is out of date: run `aube run commands`.");
		process.exit(1);
	}
} else {
	writeFileSync("docs/commands.md", doc);
	console.log("wrote docs/commands.md");
}
