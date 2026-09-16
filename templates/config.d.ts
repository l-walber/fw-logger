declare interface OptionDef {
	id: string;
	label: string;
	source_id?: number;
	defaultEmail?: string;
	tag?: string;
}

declare interface CallTypeDef {
	id: string;
	label: string;
	category: string;
	subCategory: string;
	item?: string;
	tag?: string;
}

declare interface AppConfig {
	freshserviceDomain: string;
	apiKey: string;
	agentID: number;
	groupID: number;
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
