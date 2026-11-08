// Writes docs/commands.md from mise.toml and package.json: the mise tasks (the control plane: everything outside
// this app, such as Cloudflare and Gateweave ID) and the app's scripts, each with what it is for. The
// README links to it and CLAUDE.md imports it, so the commands are listed in one place that can't drift.
// `--check` fails if the file is out of date (aube run ci does that first).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const rows = Object.entries(pkg.scripts).map(([name, run]) => {
	const why = pkg.scriptsInfo?.[name];
	if (!why) throw new Error(`package.json scriptsInfo has no line for "${name}"`);
	return `| \`aube run ${name}\` | ${why} | \`${run.replaceAll("|", "\\|")}\` |`;
});
// mise tasks, as mise itself reads the root mise.toml (`mise tasks ls --json`), in the order the file lists them: each
// with its arguments (its usage spec's args, such as <env>) and its description.
const listed = new Map(
	JSON.parse(execFileSync("mise", ["tasks", "ls", "--json"], { encoding: "utf8" })).map((task) => [
		task.name,
		task,
	]),
);
const tasks = [...readFileSync("mise.toml", "utf8").matchAll(/^\[tasks\."([^"]+)"\]/gm)].map(
	([, name]) => {
		const { description, usage } = listed.get(name);
		const args = [...(usage ?? "").matchAll(/\barg "([^"]+)"/g)]
			.map(([, arg]) => ` ${arg}`)
			.join("");
		return `| \`mise run ${name}${args}\` | ${description.replaceAll("|", "\\|")} |`;
	},
);
const doc = `# Commands

Every command in this repo. Generated from \`mise.toml\` and \`package.json\` by \`aube run commands\`, so don't edit it by
hand. If \`aube\` isn't found, put \`mise exec --\` in front, or activate mise in your shell.

## mise tasks

Everything outside the app itself: running it locally, Cloudflare, Gateweave ID, Hallmark, and keeping versions
current. From \`mise.toml\`.

| Command | What it's for |
| --- | --- |
${tasks.join("\n")}

## The app's scripts

From \`package.json\`.

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
