import type { AppConfig, OptionDef, CallTypeDef } from "./config";

export interface TicketInputs {
	location: OptionDef;
	userType: OptionDef;
	callType: CallTypeDef;
	extraText: string;
	emailOverride: string,
	customTag: string;
	leaveOpen: boolean;
	keepTag: boolean;
}

export function resolveEmail(userType: OptionDef, emailOverride: string): string | undefined {
	return emailOverride.trim() || userType.defaultEmail;
}

export function buildTags(toolTag: string, loc: OptionDef, ut: OptionDef,
						  ct: CallTypeDef, customTag: string): string[] {

	const candidates = [toolTag, loc.tag, ut.tag, ct.tag, customTag.trim()];
	return Array.from(new Set(candidates.filter((t): t is string => !!t)));
}

export function buildSubject(template: string,
							 loc: OptionDef,
							 ut: OptionDef,
							 ct: CallTypeDef
							): string {
	const map: Record<string, string> = {
		location: loc.label,
		userType: ut.label,
		callType: ct.label,
	};
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in map ? map[key] : match
						   );
}

export function buildDescription(inputs: TicketInputs): string {
	const { location, userType, callType, extraText, emailOverride } = inputs;
	const parts = [
		`Location: ${location.label}`,
		`User Type: ${userType.label}`,
		`Issue: ${callType.label}`,
	];
	if (emailOverride.trim()) {
		parts.push(`Logged for: ${emailOverride.trim()}`);
	}
	if (extraText.trim()) {
		parts.push(`Details: ${extraText.trim()}`);
	}

	return parts.join("<br><br>");
}

export function buildPayload(config: AppConfig, inputs: TicketInputs): Record<string, unknown> {
	const { location, userType, callType } = inputs;

	const payload: Record<string, unknown> = {
		email: resolveEmail(userType, inputs.emailOverride),
		subject: buildSubject(config.subjectTemplate, location, userType, callType),
		description: buildDescription(inputs),
		group_id: config.groupID,
		responder_id: config.agentID,
		priority: config.priority,
		status: inputs.leaveOpen ? 2 : config.status,
		source: config.source,
		type: config.type,
		category: callType.category,
		sub_category: callType.subCategory,
		tags: buildTags(config.toolTag, location, userType, callType, inputs.customTag),
	};

	if (callType.item) {
		payload.item_category = callType.item;
	}
	if (Object.keys(config.customFields).length > 0) {
		payload.custom_fields = config.customFields;
	}

	return payload;
}

export interface FreshserviceTicketResponse {
	ticket: { id: number;
			  subject: string};
}

export async function postTicket(
	domain: string,
	apiKey: string,
	payload: Record<string, unknown>
): Promise<FreshserviceTicketResponse> {
	const url = `https://${domain}/api/v2/tickets`;
	const resp = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": "Basic " + btoa(`${apiKey}:X`),
		},
		body: JSON.stringify(payload),
	});

	if (!resp.ok) {
		const text = await resp.text();
		throw new FreshserviceError(resp.status, text);
	}

	return resp.json() as Promise<FreshserviceTicketResponse>;
}

export class FreshserviceError extends Error {
	readonly status: number;
	readonly body: string;

	constructor(status: number, body: string) {
		super(`Freshservice API error ${status}: ${body}`);
		this.name = "FreshserviceError";
		this.status = status;
		this.body = body;
		// Preserve prototype chain when targeting older runtimes / transpilers.
		Object.setPrototypeOf(this, FreshserviceError.prototype);
	}
}
