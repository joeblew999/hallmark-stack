export { VenueDO } from "../src/server/venue-do";

export default {
	fetch: () => new Response("test worker"),
} satisfies ExportedHandler;
