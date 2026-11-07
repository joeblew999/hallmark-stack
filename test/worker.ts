// The entry for the Durable Object tests in workerd. They run with the real wrangler.jsonc (vitest.config.ts),
// whose own entry is TanStack Start's server, so this one only exports the classes it binds.
export { RateLimiter } from "../src/server/rate-limit/durable-object";
export { VenueDO } from "../src/server/venue-do";

export default {
	fetch: () => new Response("test worker"),
} satisfies ExportedHandler;
