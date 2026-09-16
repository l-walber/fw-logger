import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const external = process.env.QL_EXTERNAL_CONFIG === "1";

const PAGES = ["index", "diagnostics"] as const;
type Page = (typeof PAGES)[number];

const requested = process.env.QL_PAGE ?? "index";
if (!PAGES.includes(requested as Page)) {
	throw new Error(
		`QL_PAGE must be one of: ${PAGES.join(", ")} (got "${requested}")`
	);
}
const page = requested as Page;

function externalConfigPlugin(): Plugin {
	return {
		name: "quicklog-external-config",
		apply: "build",
		enforce: "post",
		generateBundle(_options, bundle) {
			for (const file of ["config.js", "config.d.ts", "agent-config.js", "agent-config.d.ts"]) {
				this.emitFile({
					type: "asset",
					fileName: file,
					source: readFileSync(resolve(root, "templates", file), "utf8"),
				});
			}

			const tag = `\t\t<script src="./config.js"></script>\n` +
				`\t\t<script src="./agent-config.js"></script>\n`;
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== "asset" || !chunk.fileName.endsWith(".html")) continue;
				const src = String(chunk.source);
				chunk.source = src.includes("</head>")
					? src.replace("</head>", `${tag}\t</head>`)
					: tag + src;
			}
		},
	};
}

export default defineConfig({
	plugins: [viteSingleFile(), ...(external ? [externalConfigPlugin()] : [])],
	define: { __QL_EXTERNAL__: JSON.stringify(external) },
	build: {
		target: "esnext",
		assetsInlineLimit: 100000000,
		cssCodeSplit: false,
		rollupOptions: { input: resolve(root, `${page}.html`) },
		emptyOutDir: page === "index",
	},
});
