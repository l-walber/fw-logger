import { defineConfig } from "vitest/config";

export default defineConfig({
	define: {
		__QL_EXTERNAL__: JSON.stringify(false),
	},
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.ts"],
	},
});
