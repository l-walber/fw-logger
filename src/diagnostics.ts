import "./style.css";
import { CONFIG, CONFIG_SOURCE, EXPECTS_EXTERNAL_CONFIG, AGENT_OVERRIDE_APPLIED } from "./config";
import { postTicket, FreshserviceError } from "./ticket";
import type { FreshserviceTicketResponse }  from "./ticket";

const TEST_PROFILE = {
	category: "Server",
	subCategory: "Maintenance",
	item: "Certificate",
	tag: "diagnostics-test",
} as const;

const configSummaryEl = document.getElementById("configSummary")!;

const testTicketIdEl = document.getElementById("testTicketId") as HTMLInputElement;
const testGetBtn = document.getElementById("testGetBtn") as HTMLButtonElement;
const getResultEl = document.getElementById("getResult")!;

const testEmailEl = document.getElementById("testEmail") as HTMLInputElement;
const testNoteEl = document.getElementById("testNote") as HTMLTextAreaElement;
const previewBtn = document.getElementById("previewBtn") as HTMLButtonElement;
const testPostBtn = document.getElementById("testPostBtn") as HTMLButtonElement;
const postResultEl = document.getElementById("postResult")!;

function maskKey(key: string): string {
	if (!key || key.length < 8) return "(unset or suspiciously short)";
	return `${key.slice(0, 4)}...${key.slice(-2)} (${key.length} chars)`;
}

function renderConfigSummary(): void {
	const customKeys = Object.keys(CONFIG.customFields);

	const lines = [
		`page origin:      ${location.origin}`,
		`config source:    ${CONFIG_SOURCE}`,
		`agent override:   ${AGENT_OVERRIDE_APPLIED ? "yes (agent-config.js applied" : "no"}`,
		`expects external: ${EXPECTS_EXTERNAL_CONFIG}`,
		`domain:           ${CONFIG.freshserviceDomain}`,
		`apiKey:           ${maskKey(CONFIG.apiKey)}`,
		`agentID:          ${CONFIG.agentID}`,
		`groupID:          ${CONFIG.groupID}`,
		`toolTag:          ${CONFIG.toolTag || "(none)"}`,
		`locations:        ${CONFIG.locations.length}`,
		`userTypes:        ${CONFIG.userTypes.length}`,
		`callTypes:        ${CONFIG.callTypes.length}`,
		"",
		`custom_fields:    ${customKeys.length === 0 ? "(none)" : ""}`,
		...customKeys.map(k => `  ${k}: ${JSON.stringify(CONFIG.customFields[k])}`),
		"",
		"POST test profile (hardcoded on this page):",
		`  category:       ${TEST_PROFILE.category}`,
		`  sub_category:   ${TEST_PROFILE.subCategory}`,
		`  item_category:  ${TEST_PROFILE.item}`,
		`  tags:           [${CONFIG.toolTag}, ${TEST_PROFILE.tag}]`,
	];

	if (EXPECTS_EXTERNAL_CONFIG && CONFIG_SOURCE !== "external") {
		lines.push("", "WARNING: external build, but config.js did not load.");
		lines.push("Check it sits next to this file and has no syntax errors.");
	}
	if (CONFIG.apiKey === "YOUR_API_KEY_GOES_HERE") {
		lines.push("", "WARNING: apiKey is still the placeholder.");
	}

	configSummaryEl.textContent = lines.join("\n");
}

async function handleTestGet(): Promise<void> {
	const ref = testTicketIdEl.value.trim();
	if (!ref) {
		getResultEl.textContent = "Enter a ticket ref first.";
		return;
	}

	const url = `https://${CONFIG.freshserviceDomain}/api/v2/tickets/${encodeURIComponent(ref)}`;
	testGetBtn.disabled = true;
	getResultEl.textContent = `GET ${url}\nworking...`;

	const t0 = performance.now();
	try {
		const resp = await fetch(url, {
			method: "GET",
			headers: { "Authorization": "Basic " + btoa(`${CONFIG.apiKey}:X`) },
		});
		const ms = Math.round(performance.now() - t0);

		if (!resp.ok) {
			const text = await resp.text();
			getResultEl.textContent =
				`HTTP ${resp.status} (${ms}ms)\n` +
				`Reached the server, so CORS is NOT the blocker.\n` +
				`401/403 = bad API key. 404 = no such ticket.\n\n` +
				text.slice(0, 500);
			return;
		}

		const data = (await resp.json()) as FreshserviceTicketResponse;
		getResultEl.textContent =
			`OK (${ms}ms)\nid: ${data.ticket.id}\nsubject: ${data.ticket.subject}`;
	} catch (err) {
		const ms = Math.round(performance.now() - t0);
		getResultEl.textContent =
			`Request blocked before any response (${ms}ms)\n` +
			`${(err as Error).name}: ${(err as Error).message}\n\n` +
			`Almost certainly the CORS preflight. Check the Network tab for an\n` +
			`OPTIONS request to /api/v2/tickets/${ref} with no CORS response headers.`;
	} finally {
		testGetBtn.disabled = false;
	}
}

function buildTestPayload(email: string): Record<string, unknown> {
	const note = testNoteEl.value.trim();
	const stamp = new Date().toISOString();

	const descriptionParts = [
		"POST connectivity test from Quick Call Logger.",
		`Category: ${TEST_PROFILE.category}`,
		`Sub-Category: ${TEST_PROFILE.subCategory}`,
		`Item: ${TEST_PROFILE.item}`,
		`Timestamp: ${stamp}`,
	];
	if (note) descriptionParts.push(`Details: ${note}`);

	const tags = Array.from(new Set([CONFIG.toolTag, TEST_PROFILE.tag].filter(Boolean)));

	const payload: Record<string, unknown> = {
		email,
		subject: `QuickLog POST test - ${stamp}`,
		description: descriptionParts.join("<br><br>"),
		group_id: CONFIG.groupID,
		responder_id: CONFIG.agentID,
		priority: 2,
		status: 2,
		source: 9,
		type: "Incident",
		category: TEST_PROFILE.category,
		sub_category: TEST_PROFILE.subCategory,
		item_category: TEST_PROFILE.item,
		tags,
	};

	if (Object.keys(CONFIG.customFields).length > 0) {
		payload.custom_fields = CONFIG.customFields;
	}

	return payload;
}

function requireEmail(): string | null {
	const email = testEmailEl.value.trim();
	if (!email) {
		postResultEl.textContent = "Enter a requester email first.";
		return null;
	}
	return email;
}

function handlePreview(): void {
	const email = requireEmail();
	if (!email) return;
	postResultEl.textContent =
		`POST https://${CONFIG.freshserviceDomain}/api/v2/tickets\n\n` +
		JSON.stringify(buildTestPayload(email), null, 2);
}

async function handleTestPost(): Promise<void> {
	const email = requireEmail();
	if (!email) return;

	const payload = buildTestPayload(email);

	testPostBtn.disabled = true;
	postResultEl.textContent =
		`POST https://${CONFIG.freshserviceDomain}/api/v2/tickets\nworking...`;

	const t0 = performance.now();
	try {
		const data = await postTicket(CONFIG.freshserviceDomain, CONFIG.apiKey, payload);
		const ms = Math.round(performance.now() - t0);
		const ticketUrl = `https://${CONFIG.freshserviceDomain}/a/tickets/${data.ticket.id}`;
		postResultEl.textContent =
			`OK (${ms}ms)\n` +
			`id: ${data.ticket.id}\n` +
			`${ticketUrl}\n\n` +
			`Remember to close/delete this test ticket.`;
	} catch (err) {
		const ms = Math.round(performance.now() - t0);
		if (err instanceof FreshserviceError) {
			postResultEl.textContent =
				`HTTP ${err.status} (${ms}ms)\n` +
				`Reached the server, so CORS is NOT the blocker.\n` +
				`  401/403 = bad API key or agent lacks create rights.\n` +
				`  400 = payload rejected (bad email, group_id, responder_id,\n` +
				`        a category/sub_category/item_category that does not exist,\n` +
				`        or a custom_fields key this instance does not have).\n\n` +
				err.body.slice(0, 500);
		} else {
			postResultEl.textContent =
				`Request blocked before any response (${ms}ms)\n` +
				`${(err as Error).name}: ${(err as Error).message}\n\n` +
				`Almost certainly the CORS preflight - check the Network tab\n` +
				`for the OPTIONS request to /api/v2/tickets with no CORS headers.`;
		}
	} finally {
		testPostBtn.disabled = false;
	}
}

testGetBtn.addEventListener("click", handleTestGet);
previewBtn.addEventListener("click", handlePreview);
testPostBtn.addEventListener("click", handleTestPost);
renderConfigSummary();
