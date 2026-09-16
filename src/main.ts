import "./style.css";

const userStyles = import.meta.glob("./userstyles.css", { eager: true });
if (Object.keys(userStyles).length > 0) {
	console.log("Loaded userstyle.css override");
}

import {
	CONFIG,
	CONFIG_SOURCE,
	EXPECTS_EXTERNAL_CONFIG,
	DEMO_DOMAIN,
	type OptionDef,
	type CallTypeDef,
} from "./config";

import {
	buildPayload,
	postTicket,
	type TicketInputs,
} from "./ticket";

interface State {
	location: string | null;
	userType: string | null;
	callType: string | null;
	extraText: string;
	emailOverride: string;
	customTag: string;
	leaveOpen: boolean;
	keepTag: boolean;
}

function main(): void {
	const state: State = {
		location: null,
		userType: null,
		callType: null,
		extraText: "",
		emailOverride: "",
		customTag: "",
		keepTag: false,
		leaveOpen: false,
	};

	const locationGrid = document.getElementById("locationGrid")!;
	const userTypeGrid = document.getElementById("userTypeGrid")!;
	const callTypeGrid = document.getElementById("callTypeGrid")!;
	const emailOverrideSection = document.getElementById("emailOverrideSection")!;
	const emailOverrideEl = document.getElementById("emailOverride") as HTMLInputElement;
	const extraTextEl = document.getElementById("extraText") as HTMLTextAreaElement;
	const logCallBtn = document.getElementById("logCallBtn") as HTMLButtonElement;
	const statusEl = document.getElementById("status")!;
	const historyEl = document.getElementById("history")!;
	const customTagEl = document.getElementById("customTag") as HTMLInputElement;
	const leaveOpenEl = document.getElementById("leaveOpen") as HTMLInputElement;
	const keepTagEl = document.getElementById("keepCustomTag") as HTMLInputElement;

	function renderOptionGrid(
		container: HTMLElement,
		options: OptionDef[] | CallTypeDef[],
		selectedId: string | null,
		onSelect: (id: string) => void
	): void {
		container.innerHTML = "";
		for (const option of options) {
			const button = document.createElement("button");
			button.className = "option" + (option.id === selectedId ? " selected" : "");
			button.textContent = option.label;
			button.addEventListener("click", () => onSelect(option.id));
			container.appendChild(button);
		}
	}

	const currentUserType = () =>
		CONFIG.userTypes.find(u => u.id === state.userType) ?? null;
	const currentCallType = () =>
		CONFIG.callTypes.find(c => c.id === state.callType) ?? null;
	const currentLocation = () =>
		CONFIG.locations.find(l => l.id === state.location) ?? null;

	function canSubmit(): boolean {
		return !!(state.location && state.userType && state.callType);
	}

	function render(): void {
		renderOptionGrid(locationGrid, CONFIG.locations, state.location, id => {
			state.location = id;
			render();
		});
		renderOptionGrid(userTypeGrid, CONFIG.userTypes, state.userType, id => {
			state.userType = id;
			render();
		});
		renderOptionGrid(callTypeGrid, CONFIG.callTypes, state.callType, id => {
			state.callType = id;
			render();
		});

		const ut = currentUserType();
		emailOverrideSection.style.display = ut?.defaultEmail ? "block" : "none";
		logCallBtn.disabled = !canSubmit();
	}

	function collectInputs(): TicketInputs | null {
		const location = currentLocation();
		const userType = currentUserType();
		const callType = currentCallType();
		if (!location || !userType || !callType) return null;
		return {
			location,
			userType,
			callType,
			extraText: state.extraText,
			emailOverride: state.emailOverride,
			customTag: state.customTag,
			leaveOpen: state.leaveOpen,
			keepTag: state.keepTag,
		};
	}

	function resetAfterSubmit(): void {
		state.userType = null;
		state.callType = null;
		state.extraText = "";
		state.emailOverride = "";
		extraTextEl.value = "";
		emailOverrideEl.value = "";
		customTagEl.value = "";
		leaveOpenEl.checked = false;

		if (!keepTagEl.checked) {
			state.customTag = "";			
		}

		render();
	}

	function addHistoryEntry(ticketId: number, ticketUrl: string): void {
		const li = document.createElement("li");
		const a = document.createElement("a");
		a.href = ticketUrl;
		a.target = "_blank";
		a.textContent = `Ticket #${ticketId}`;
		li.appendChild(a);
		historyEl.prepend(li);
	}

	async function handleLogCall(): Promise<void> {
		const inputs = collectInputs();
		if (!inputs) return;

		logCallBtn.disabled = true;
		statusEl.textContent = "Submitting...";

		const isDemo = CONFIG.freshserviceDomain === DEMO_DOMAIN;

		try {
			let ticketId: number;
			let ticketUrl: string;

			if (isDemo) {
				ticketId = Math.floor(Math.random() * 90000) + 10000;
				ticketUrl = window.location.href;
			} else {
				const payload = buildPayload(CONFIG, inputs);
				const result = await postTicket(CONFIG.freshserviceDomain, CONFIG.apiKey, payload);
				ticketId = result.ticket.id;
				ticketUrl = `https://${CONFIG.freshserviceDomain}/a/tickets/${ticketId}`;
			}

			addHistoryEntry(ticketId, ticketUrl);
			statusEl.textContent = "";
			resetAfterSubmit();
		} catch (err) {
			console.error(err);
			statusEl.textContent = `Error: ${(err as Error).message}`;
		}

		setTimeout(() => {
			logCallBtn.disabled = !canSubmit();
		}, 1000);
	}

	extraTextEl.addEventListener("input", () => {
		state.extraText = extraTextEl.value;
	});
	emailOverrideEl.addEventListener("input", () => {
		state.emailOverride = emailOverrideEl.value.trim();
	});
	customTagEl.addEventListener("input", () => {
		state.customTag = customTagEl.value.trim();
	});
	leaveOpenEl.addEventListener("change", () => {
		state.leaveOpen = leaveOpenEl.checked;
	});
	keepTagEl.addEventListener("change", () => {
		state.keepTag = keepTagEl.checked;
	});
	logCallBtn.addEventListener("click", handleLogCall);

	if (CONFIG.freshserviceDomain === DEMO_DOMAIN) {
		statusEl.textContent = "DEMO MODE";
	};

	if (EXPECTS_EXTERNAL_CONFIG && CONFIG_SOURCE !== "external") {
		statusEl.textContent =
			"config.js not found or invalid - place config.js next to index.html. Using defaults for now.";
	};

	render();
}

if (import.meta.env.MODE !== "test") {
	main();
}
