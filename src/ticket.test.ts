import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	resolveEmail,
	buildSubject,
	buildTags,
	buildDescription,
	buildPayload,
	postTicket,
	FreshserviceError,
	type TicketInputs,
} from "./ticket";
import type { AppConfig, OptionDef, CallTypeDef } from "./config";

// Fixtures

const staff: OptionDef = { id: "staff", label: "Staff", defaultEmail: "staff@example.com", tag: "staff" };
const guest: OptionDef = { id: "guest", label: "Guest" }; // no defaultEmail, no tag
const siteA: OptionDef = { id: "site-a", label: "Site A", tag: "Location:A" };
const printing: CallTypeDef = {
	id: "printing", label: "Printing Issue",
	category: "Printing", subCategory: "Printing", item: "Paper refill", tag: "print",
};
const password: CallTypeDef = {
	id: "pw", label: "Password Reset",
	category: "User Admin", subCategory: "Password Reset", // no item, no tag
};

const baseConfig: AppConfig = {
	freshserviceDomain: "test.freshservice.example.com",
	apiKey: "test-key-1234",
	agentID: 111,
	groupID: 222,
	customFields: {},
	subjectTemplate: "QuickLog: {location}::{callType}",
	locations: [siteA],
	userTypes: [staff, guest],
	callTypes: [printing, password],
	toolTag: "quicklog",
	priority: 2,
	source: 9,
	type: "Incident",
	status: 2,
};

function inputs(overrides: Partial<TicketInputs> = {}): TicketInputs {
	return {
		location: siteA,
		userType: staff,
		callType: printing,
		extraText: "",
		emailOverride: "",
		customTag: "",
		...overrides,
	};
}

// Does email override work?

describe("resolveEmail", () => {
	it("uses the override when provided", () => {
		expect(resolveEmail(staff, "homer@example.com")).toBe("homer@example.com");
	});

	it("trims the override", () => {
		expect(resolveEmail(staff, "  homer@example.com  ")).toBe("homer@example.com");
	});

	it("falls back to defaultEmail when override is blank", () => {
		expect(resolveEmail(staff, "   ")).toBe("staff@example.com");
	});

	it("returns undefined when neither override nor defaultEmail exist", () => {
		expect(resolveEmail(guest, "")).toBeUndefined();
	});
});

// Does the email subject generation work?

describe("buildSubject", () => {
	it("substitutes all known placeholders", () => {
		expect(buildSubject("{location}::{userType}::{callType}", siteA, staff, printing))
			.toBe("Site A::Staff::Printing Issue");
	});

	it("leaves unknown placeholders intact", () => {
		expect(buildSubject("{location} {nope}", siteA, staff, printing))
			.toBe("Site A {nope}");
	});

	it("handles a template with no placeholders", () => {
		expect(buildSubject("static subject", siteA, staff, printing))
			.toBe("static subject");
	});
});

// Do all the tags accumulate properly

describe("buildTags", () => {
	it("includes toolTag first, then option tags and customTag", () => {
		expect(buildTags("quicklog", siteA, staff, printing, "urgent"))
			.toEqual(["quicklog", "Location:A", "staff", "print", "urgent"]);
	});

	it("drops undefined option tags", () => {
		// guest has no tag, password has no tag
		expect(buildTags("quicklog", siteA, guest, password, ""))
			.toEqual(["quicklog", "Location:A"]);
	});

	it("trims and includes a customTag", () => {
		expect(buildTags("quicklog", siteA, guest, password, "  hot  "))
			.toEqual(["quicklog", "Location:A", "hot"]);
	});

	it("dedupes repeated tags", () => {
		expect(buildTags("dup", siteA, staff, printing, "dup"))
			.toEqual(["dup", "Location:A", "staff", "print"]);
	});

	it("drops an empty toolTag", () => {
		expect(buildTags("", siteA, guest, password, ""))
			.toEqual(["Location:A"]);
	});
});

// Does the description match the components?

describe("buildDescription", () => {
	it("includes the core fields", () => {
		const d = buildDescription(inputs());
		expect(d).toContain("Location: Site A");
		expect(d).toContain("User Type: Staff");
		expect(d).toContain("Issue: Printing Issue");
	});

	it("adds the override email line only when present", () => {
		expect(buildDescription(inputs({ emailOverride: "" })))
			.not.toContain("Logged for:");
		expect(buildDescription(inputs({ emailOverride: "a@b.com" })))
			.toContain("Logged for: a@b.com");
	});

	it("adds details only when extraText is non-empty", () => {
		expect(buildDescription(inputs({ extraText: "  " })))
			.not.toContain("Details:");
		expect(buildDescription(inputs({ extraText: "printer jammed" })))
			.toContain("Details: printer jammed");
	});
});

// Assemble the call payload

describe("buildPayload", () => {
	it("builds a complete payload with sensible fixed fields", () => {
		const p = buildPayload(baseConfig, inputs());
		expect(p).toMatchObject({
			email: "staff@example.com",
			subject: "QuickLog: Site A::Printing Issue",
			group_id: 222,
			responder_id: 111,
			priority: 2,
			status: 2,
			source: 9,
			type: "Incident",
			category: "Printing",
			sub_category: "Printing",
			item_category: "Paper refill",
			tags: ["quicklog", "Location:A", "staff", "print"],
		});
	});

	it("omits item_category when the callType has no item", () => {
		const p = buildPayload(baseConfig, inputs({ callType: password }));
		expect(p).not.toHaveProperty("item_category");
	});

	it("omits custom_fields when config has none", () => {
		const p = buildPayload(baseConfig, inputs());
		expect(p).not.toHaveProperty("custom_fields");
	});

	it("includes custom_fields when config provides them", () => {
		const cfg: AppConfig = { ...baseConfig, customFields: { cf_room: "101" } };
		const p = buildPayload(cfg, inputs());
		expect(p.custom_fields).toEqual({ cf_room: "101" });
	});

	it("uses the override email over the userType default", () => {
		const p = buildPayload(baseConfig, inputs({ emailOverride: "over@example.com" }));
		expect(p.email).toBe("over@example.com");
	});
});

// Does the call logging stuff respond properly

describe("postTicket", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function mockFetch() {
		return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
	}

	it("sends a POST with correct URL, headers and body", async () => {
		mockFetch().mockResolvedValue({
			ok: true,
			json: async () => ({ ticket: { id: 42 } }),
		});

		const payload = { subject: "hi" };
		const result = await postTicket("d.example.com", "abc", payload);

		expect(result).toEqual({ ticket: { id: 42 } });

		const [url, init] = mockFetch().mock.calls[0];
		expect(url).toBe("https://d.example.com/api/v2/tickets");
		expect(init.method).toBe("POST");
		expect(init.headers["Content-Type"]).toBe("application/json");
		expect(init.headers["Authorization"]).toBe("Basic " + btoa("abc:X"));
		expect(JSON.parse(init.body)).toEqual(payload);
	});

	it("throws FreshserviceError with status and body on a non-ok response", async () => {
		mockFetch().mockResolvedValue({
			ok: false,
			status: 400,
			text: async () => "bad email",
		});

		const err = await postTicket("d.example.com", "abc", {}).catch(e => e);
		expect(err).toBeInstanceOf(FreshserviceError);
		expect(err.status).toBe(400);
		expect(err.body).toBe("bad email");
		expect(err.message).toContain("400");
	});

	it("propagates a network error (fetch rejects) untouched", async () => {
		const netErr = new TypeError("Failed to fetch");
		mockFetch().mockRejectedValue(netErr);

		const err = await postTicket("d.example.com", "abc", {}).catch(e => e);
		expect(err).toBe(netErr);
		expect(err).not.toBeInstanceOf(FreshserviceError);
	});
});
