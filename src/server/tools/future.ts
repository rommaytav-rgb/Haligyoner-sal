import { unavailableTool, type Tool } from "./types";

/**
 * Capabilities the architecture supports but this deployment does not have.
 *
 * They are registered deliberately: the orchestrator can see that an action
 * would need `sendEmail`, mark the step as blocked, and tell the user exactly
 * what is missing - instead of pretending an email went out (sections 23, 25).
 */
const notConnected = (what: string) =>
  `${what} isn't connected yet. We can prepare everything for you, but you'll need to send it yourself for now.`;

export const FUTURE_TOOLS: Tool<Record<string, unknown>, unknown>[] = [
  unavailableTool("sendEmail", "Send an approved email on the user's behalf.", notConnected("Outbound email")),
  unavailableTool("makePhoneCall", "Place a call on the user's behalf.", notConnected("Phone calling")),
  unavailableTool("browserAutomation", "Complete a web form on the user's behalf.", notConnected("Browser automation")),
  unavailableTool("trackShipment", "Look up the status of a shipment.", notConnected("Shipment tracking")),
  unavailableTool("connectGmail", "Read case-related email from Gmail.", notConnected("Gmail")),
  unavailableTool("connectOutlook", "Read case-related email from Outlook.", notConnected("Outlook")),
  unavailableTool("connectCalendar", "Add deadlines to a calendar.", notConnected("Calendar access")),
  unavailableTool("connectBank", "Read transactions to confirm a charge.", notConnected("Bank connections")),
  unavailableTool("connectAirline", "Look up a booking with an airline.", notConnected("Airline connections")),
  unavailableTool("connectInsurance", "Look up an insurance policy.", notConnected("Insurer connections")),
];
