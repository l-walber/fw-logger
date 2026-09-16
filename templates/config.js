// @ts-check
/// <reference path="./config.d.ts" />
// Quick Call Logger configuration.
// Edit this file, keep it next to index.html. No build step needed.

/** @type {Partial<AppConfig>} */
var QUICKLOG_CONFIG = {
	freshserviceDomain: "changethis.freshservice.example.com",
	apiKey: "YOUR_API_KEY_GOES_HERE",
	agentID: 123456,
	groupID: 987654,

	priority: 2,
	status: 2,
	source: 9,
	type: "Incident",

	customFields: {},

	// Applied to every ticket logged via this tool, in addition to any
	// location/userType/callType tags below.
	toolTag: "quicklog",

	// Build the subject line for calls.
	// Available placeholders are {location}, {userType}, and {callType}
	subjectTemplate: "QuickLog: {location}::{callType}",

	locations: [
		{ id: "site-a", label: "Site A" },
		{ id: "sector-7g", label: "Nuclear Safety", tag: "Location:7G" },
		{ id: "library-site", label: "Library Desk" },
	],

	// defaultEmail is the generic requester; the UI offers a per-call override.
	// tag (optional) is added to the ticket's tags when this option is selected.
	userTypes: [
		{ id: "staff", label: "Staff", defaultEmail: "staffuser@example.com", tag: "staff" },
		{ id: "guest", label: "Guest", defaultEmail: "guest@example.com" },
	],

	// category / subCategory / item must match your Freshservice values exactly.
	// tag (optional) is added to the ticket's tags when this call type is selected.
	callTypes: [
		{ id: "password-reset", label: "Password Reset", category: "User Admin", subCategory: "Password Reset" },
		{ id: "printing-issue", label: "Printing Issue", category: "Printing", subCategory: "Printing", item: "Paper refill", tag: "print" },
	],
};
