import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	resolve: { tsconfigPaths: true },
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
