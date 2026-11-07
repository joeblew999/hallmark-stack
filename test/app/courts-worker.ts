// From Gateweave Track (github.com/gateweavehq/track) at b8b5ba0: apps/web/test/track-worker.ts, the parts sign-in
// needs. Its email outbox, webhook receiver, Turnstile, GitHub, file bucket, workspace inspector, WebSockets and email
// handler are left out: courts has none of them.
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { convertV4MiniflareOptions, Miniflare, type V4ModuleDefinition } from "miniflare";

const app = resolve(import.meta.dirname, "../..");
const serverDir = join(app, "dist/server");

interface BuiltConfig {
	compatibility_date: string;
	compatibility_flags?: string[];
}

/** One line the Worker wrote to its console. */
export interface WorkerLog {
	level: string;
	message: string;
}

/**
 * A caller that gives up: it passes a request to the last isolate through a service binding and aborts
 * after a moment, which cancels the request there as a client going away does in production. A client
 * hanging up on Miniflare does not.
 */
const IMPATIENT = `
export default {
	async fetch(request, env) {
		const target = new Request(new URL(request.url).searchParams.get("to"), request);
		try {
			return await env.TARGET.fetch(target, { signal: AbortSignal.timeout(300) });
		} catch {
			return new Response("Stopped waiting", { status: 504 });
		}
	},
};
`;

/** Every module of the built Worker. Its migrations are imported as text. */
function builtModules(): V4ModuleDefinition[] {
	const modules: V4ModuleDefinition[] = [];
	for (const file of readdirSync(serverDir, { recursive: true, encoding: "utf8" })) {
		const path = join(serverDir, file);
		if (file.endsWith(".js")) modules.push({ type: "ESModule", path });
		else if (file.endsWith(".sql")) modules.push({ type: "Text", path });
	}
	return modules;
}

/**
 * The built Worker in workerd, as deployed: D1 migrated, the venue's and the rate limiter's Durable
 * Objects, and served at `origin` without a network. Requests go in through `fetch`.
 *
 * Every outbound request fails, the way a deployed Worker's request to its own hostname does, unless
 * `outbound` answers it as a stand-in for that service (the provider, in test/app/oidc-provider.ts).
 *
 * `vars` sets more of its configuration. `isolateVars[i]` adds to it for copy `i` alone.
 *
 * With `isolates` above 1, more copies of the Worker share the database and Durable Objects but
 * nothing in memory, as isolates in production do. `fetchIn` reaches a given one.
 */
export async function startCourts(
	origin: string,
	{
		isolates = 1,
		vars = {},
		isolateVars = [],
		outbound: standIn,
	}: {
		isolates?: number;
		vars?: Record<string, string>;
		isolateVars?: Record<string, string>[];
		/** Answers the Worker's outbound requests it recognizes, as a stand-in for that service. */
		outbound?: (request: Request, url: URL) => Promise<Response | undefined>;
	} = {},
) {
	const config = JSON.parse(readFileSync(join(serverDir, "wrangler.json"), "utf8")) as BuiltConfig;
	const outbound: string[] = [];
	const logs: WorkerLog[] = [];
	const modules = builtModules();
	const secret = randomBytes(32).toString("base64url");
	const names = Array.from({ length: isolates }, (_, i) =>
		i === 0 ? "courts" : `courts-${i + 1}`,
	);
	// Miniflare 5 still takes its documented v4 options through this converter.
	const mf = new Miniflare(
		convertV4MiniflareOptions({
			// Keep what the Worker logs for `logs`, and still show it as Miniflare would.
			handleStructuredLogs: (log) => {
				logs.push(log);
				console.error(`[worker ${log.level}] ${log.message}`);
			},
			workers: [
				...names.map((name, index) => ({
					name,
					// Requests go to the first copy unless their host is another copy's route.
					routes: index === 0 ? [] : [`${name}.test/*`],
					modules,
					modulesRoot: serverDir,
					compatibilityDate: config.compatibility_date,
					compatibilityFlags: config.compatibility_flags,
					bindings: {
						BETTER_AUTH_SECRET: secret,
						BETTER_AUTH_URL: origin,
						...vars,
						...isolateVars[index],
					},
					d1Databases: { DB: "courts-test" },
					// Every copy uses the first one's Durable Objects.
					durableObjects: {
						VENUE: { className: "VenueDO", useSQLite: true, scriptName: names[0] },
						RATE_LIMITER: { className: "RateLimiter", useSQLite: true, scriptName: names[0] },
					},
					outboundService: async (request: Request) => {
						const url = new URL(request.url);
						const answered = await standIn?.(request, url);
						if (answered) return answered;
						outbound.push(request.url);
						return new Response("Outbound requests are blocked in this test", { status: 502 });
					},
				})),
				{
					name: "impatient",
					modules: true,
					script: IMPATIENT,
					routes: ["impatient.test/*"],
					compatibilityDate: config.compatibility_date,
					serviceBindings: { TARGET: names[names.length - 1] as string },
				},
			],
		}),
	);

	const db = await mf.getD1Database("DB");
	const migrations = join(app, "migrations");
	for (const file of readdirSync(migrations)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		const statements = readFileSync(join(migrations, file), "utf8")
			.split("--> statement-breakpoint")
			.map((statement) => statement.trim())
			.filter(Boolean);
		await db.batch(statements.map((statement) => db.prepare(statement)));
	}

	/** A `fetch` that reaches one copy of the Worker directly. Redirects are returned. */
	async function fetchIn(
		isolate: number,
		input: string | URL | Request,
		init?: RequestInit,
	): Promise<Response> {
		const name = names[isolate];
		if (!name) throw new Error(`There are only ${names.length} isolates`);
		const request = new Request(input, init);
		const url = new URL(request.url);
		if (isolate > 0) url.host = `${name}.test`;
		const response = await mf.dispatchFetch(url, {
			method: request.method,
			headers: [...request.headers],
			body: request.body ? await request.arrayBuffer() : undefined,
			redirect: "manual",
		});
		const headers = new Headers();
		for (const [name, value] of response.headers) {
			if (name !== "set-cookie") headers.append(name, value);
		}
		for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
		const empty = response.status === 204 || response.status === 304;
		return new Response(empty ? null : await response.arrayBuffer(), {
			status: response.status,
			headers,
		});
	}

	return {
		/** A `fetch` that reaches the Worker directly. Redirects are returned, not followed. */
		fetch: (input: string | URL | Request, init?: RequestInit) => fetchIn(0, input, init),
		fetchIn,
		/** Sends a request to the last isolate from a caller that stops waiting after a moment. */
		fetchAndStopWaiting: (url: string, init: RequestInit) =>
			mf.dispatchFetch(`http://impatient.test/?to=${encodeURIComponent(url)}`, {
				method: init.method,
				headers: [...new Headers(init.headers)],
				body: init.body as string,
			}),
		/** URLs the Worker tried to fetch from outside. */
		outbound,
		/** Everything the Worker has logged so far, oldest first. */
		logs,
		/** The D1 database, for setting up state the app has no endpoint for. */
		db,
		dispose: () => mf.dispose(),
	};
}
