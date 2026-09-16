import type { AppConfig } from "./config"

export const userConfig: Partial<AppConfig> = {
	freshserviceDomain: "changethis.freshservice.example.com",
	apiKey: "YOUR_API_KEY_GOES_HERE", // Keep the quotes as-is
	agentID: 123456,  // No quotes for numbers
	groupID: 987654,
	priority: 2,     // 1=Low, 2=Medium, 3=High, 4=Urgent
	status: 2,       // 2=Open, 3=Pending, 4=Resolved, 5=Closed
	source: 9,       // Source ID from Freshservice
	type: "Incident",
	toolTag: "quicklog",
	subjectTemplate: "QuickLog: {location}::{callType}",
	customFields: {
		// "custom_field_name": "value",
	},
	locations: [
		{ id: "site-a", label: "Site A" },
		{ id: "sector-7g", label: "Nuclear Safety", tag: "Location:7G" },
		{ id: "library-site", label: "Library Desk" },
	],
	userTypes: [
		{ id: "staff", label: "Staff", defaultEmail: "staffuser@example.com", tag: "staff" },
		{ id: "guest", label: "Guest", defaultEmail: "guest@example.com" },
	],
	callTypes: [
		{ id: "password-reset", label: "Password Reset", category: "User Admin", subCategory: "Password Reset" },
		{ id: "printing-issue", label: "Printing Issue", category: "Printing", subCategory: "Printing", item: "Paper refill", tag: "print" },
	],
};
