// Every page the app has, as TanStack Router's generated route tree (src/routeTree.gen.ts) lists them: its
// `fullPaths`. The snapshot and Hallmark's lint both read it, so a new route is in both without listing it.
import { readFileSync } from "node:fs";

export function routePaths(tree = readFileSync("src/routeTree.gen.ts", "utf8")) {
	const union = tree.match(/fullPaths:([\s\S]*?)\n\s+fileRoutesByTo/)?.[1];
	if (!union) throw new Error("src/routeTree.gen.ts has no fullPaths: run aube run typegen");
	return [...new Set(union.match(/'\/[^']*'/g) ?? [])].map((q) => q.slice(1, -1)).sort();
}
