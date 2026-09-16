export interface OptionDef {
	id: string;
	label: string;
	source_id?: number;
	defaultEmail?: string;
	tag?: string;
}

export interface CallTypeDef {
	id: string;
	label: string;
	category: string;
	subCategory: string;
	item?: string;
	tag?: string;
}

export interface AppConfig {
	freshserviceDomain: string;
	apiKey: string;
	agentID: number,
	groupID: number,
	customFields: Record<string, unknown>;
	locations: OptionDef[];
	userTypes: OptionDef[];
	callTypes: CallTypeDef[];
	toolTag: string;
	subjectTemplate: string;
	priority: number;
	status: number;
	source: number;
	type: string;
}

declare global {
	var QUICKLOG_CONFIG: Partial<AppConfig> | undefined;
	var QUICKLOG_AGENT_CONFIG: AgentOverrides | undefined;
	const __QL_EXTERNAL__: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
	freshserviceDomain: "changethis.freshservice.example.com",
	apiKey: "YOUR_API_KEY_GOES_HERE",
	agentID: 123456,
	groupID: 987654,
	priority: 2,
	status: 2,
	source: 9,
	type: "Incident",
	customFields: {},
	subjectTemplate: "QuickLog: {location}::{callType}",
	locations: [
		{ id: "site-a", label: "Site A" },
		{ id: "sector-7g", label: "Nuclear Safety Office" },
		{ id: "library-site", label: "Library Desk" },
	],
	userTypes: [
		{ id: "staff", label: "Staff", defaultEmail: "staffuser@example.com" },
		{ id: "guest", label: "Guest", defaultEmail: "guest@example.com" },
	],
	callTypes: [
		{ id: "password-reset", label: "Password Reset", category: "User Admin", subCategory: "Password Reset" },
		{ id: "printing-issue", label: "Printing Issue", category: "Printing", subCategory: "Printing", item: "Paper refill" },
	],
	toolTag: "quicklog",
};

export const DEMO_DOMAIN = DEFAULT_CONFIG.freshserviceDomain;

const userConfigModules = import.meta.glob<{ userConfig: Partial<AppConfig> }>(
	"./userconfig.ts",
	{ eager: true }
);

export interface AgentOverrides {
	apiKey?: string;
	agentID?: number;
	groupID?: number;
}

export type ConfigSource = "defaults" | "bundled" | "external";

export function resolveConfig(): ResolvedConfig {
	let config = { ...DEFAULT_CONFIG };
	let source: ConfigSource = "defaults";
	let agentOverrideApplied = false;

	const bundled = Object.values(userConfigModules)[0]?.userConfig;
	if (bundled) {
		config = { ...config, ...bundled };
		source = "bundled";
	}

	const external = globalThis.QUICKLOG_CONFIG;
	if (external) {
		config = { ...config, ...external };
		source = "external";
	}

	const agent = globalThis.QUICKLOG_AGENT_CONFIG;
	if (agent) {
		const { apiKey, agentID, groupID } = agent;
		config = {
			...config,
			...(apiKey !== undefined ? { apiKey } : {}),
			...(agentID !== undefined ? { agentID } : {}),
			...(groupID !== undefined ? { groupID } : {}),
		};
		agentOverrideApplied = true;
	}

	return { config, source, agentOverrideApplied };
}

export interface ResolvedConfig {
	config: AppConfig;
	source: ConfigSource;
	agentOverrideApplied: boolean;
}

const resolved = resolveConfig();
export const CONFIG: AppConfig = resolved.config;
export const CONFIG_SOURCE: ConfigSource = resolved.source;
export const AGENT_OVERRIDE_APPLIED: boolean = resolved.agentOverrideApplied;
export const EXPECTS_EXTERNAL_CONFIG: boolean = __QL_EXTERNAL__;
