// Gateweave ID's own Vite config, unchanged, for mise run all:dev (scripts/dev.mjs), with one setting added: behind
// Tailscale Funnel the browser reaches ID's dev server on 443, not its own port, so live reload is told to use 443
// (Vite's hmr.clientPort, for a server behind a proxy, as courts' vite.config.ts does). Without it the connection
// fails and ID's pages reload themselves over and over, sign-up included. ID's files are never edited: this imports
// them from the pinned release in vendor/gateweave-id.
import { mergeConfig } from "vite";
import id from "../vendor/gateweave-id/apps/web/vite.config.ts";

export default async (env) =>
	mergeConfig(typeof id === "function" ? await id(env) : id, {
		server: { hmr: { clientPort: Number(process.env.DEV_HMR_CLIENT_PORT) } },
	});
