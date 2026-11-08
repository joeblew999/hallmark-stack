import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	// Behind mise run all:dev's Tailscale Funnel the browser reaches this dev server on 443, not on its own port, so live
	// reload's connection is told to use 443 (Vite's hmr.clientPort, for a server behind a proxy). Without it the
	// connection fails and the page reloads itself over and over. Unset everywhere else, so it changes nothing there.
	...(process.env.DEV_HMR_CLIENT_PORT && {
		server: { hmr: { clientPort: Number(process.env.DEV_HMR_CLIENT_PORT) } },
	}),
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		// tsr.config.json carries Start's route-tree footer so `tsr generate` (typegen, typecheck) writes the same
		// src/routeTree.gen.ts as the build. Start writes that footer itself and reads tsr.config.json too, so this
		// empty one, which wins over the file, keeps it from being written twice.
		tanstackStart({ router: { routeTreeFileFooter: [] } }),
		viteReact(),
	],
});
