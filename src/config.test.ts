import { describe, it, expect, afterEach } from "vitest";
import { resolveConfig } from "./config";
import type { AppConfig } from "./config";

afterEach(() => {
	delete (globalThis as { QUICKLOG_CONFIG?: unknown }).QUICKLOG_CONFIG;
	delete (globalThis as { QUICKLOG_AGENT_CONFIG?: unknown }).QUICKLOG_AGENT_CONFIG;
});

describe("resolveConfig", () => {
	it("returns defaults when nothing overrides them", () => {
		const { config, source } = resolveConfig();
		expect(source).toBe("defaults");
		expect(config.freshserviceDomain).toBe("changethis.freshservice.example.com");
		expect(config.locations.length).toBeGreaterThan(0);
	});

	it("applies external config and marks the source as external", () => {
		globalThis.QUICKLOG_CONFIG = {
			freshserviceDomain: "real.freshservice.example.com",
			apiKey: "external-key",
		};

		const { config, source } = resolveConfig();
		expect(source).toBe("external");
		expect(config.freshserviceDomain).toBe("real.freshservice.example.com");
		expect(config.apiKey).toBe("external-key");
	});

	it("external config overrides only the keys it provides", () => {
		globalThis.QUICKLOG_CONFIG = { apiKey: "just-the-key" };

		const { config } = resolveConfig();
		expect(config.apiKey).toBe("just-the-key");
		expect(config.freshserviceDomain).toBe("changethis.freshservice.example.com");
		expect(config.agentID).toBe(123456);
	});

	it("replaces array fields wholesale rather than merging them", () => {
		globalThis.QUICKLOG_CONFIG = {
			locations: [{ id: "only", label: "Only Location" }],
		};

		const { config } = resolveConfig();
		expect(config.locations).toEqual([{ id: "only", label: "Only Location" }]);
	});

	it("does not mutate the returned config across calls", () => {
		const first = resolveConfig().config;
		first.freshserviceDomain = "mutated";

		const second = resolveConfig().config;
		expect(second.freshserviceDomain).toBe("changethis.freshservice.example.com");
	});

	it("treats a falsy QUICKLOG_CONFIG as absent", () => {
		globalThis.QUICKLOG_CONFIG = undefined;
		const { source } = resolveConfig();
		expect(source).toBe("defaults");
	});

	it("accepts a partial external config with custom fields", () => {
		globalThis.QUICKLOG_CONFIG = {
			customFields: { cf_building: "Castle Grayskull" } as AppConfig["customFields"],
		};
		const { config } = resolveConfig();
		expect(config.customFields).toEqual({ cf_building: "Castle Grayskull" });
	});

	it("applies agent overrides and sets agentOverrideApplied", () => {
		globalThis.QUICKLOG_AGENT_CONFIG = { apiKey: "agent-key", agentID: 999 };
		const { config, agentOverrideApplied } = resolveConfig();
		expect(agentOverrideApplied).toBe(true);
		expect(config.apiKey).toBe("agent-key");
		expect(config.agentID).toBe(999);
		expect(config.groupID).toBe(987654); // untouched
	});

	it("agent overrides apply on top of external config", () => {
		globalThis.QUICKLOG_CONFIG = { apiKey: "external-key", groupID: 111 };
		globalThis.QUICKLOG_AGENT_CONFIG = { apiKey: "agent-key" };
		const { config } = resolveConfig();
		expect(config.apiKey).toBe("agent-key"); // agent wins
		expect(config.groupID).toBe(111); // external value preserved
	});

	it("agentOverrideApplied is false when no agent config present", () => {
		const { agentOverrideApplied } = resolveConfig();
		expect(agentOverrideApplied).toBe(false);
	});

});
