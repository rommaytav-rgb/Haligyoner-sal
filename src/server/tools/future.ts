import { unavailableTool, type Tool } from "./types";

/**
 * Capabilities the architecture supports but this deployment does not have.
 *
 * They are registered deliberately: the orchestrator can see that an action
 * would need `sendEmail`, mark the step as blocked, and tell the user exactly
 * what is missing - instead of pretending an email went out (sections 23, 25).
 */
const notConnected = (whatKey: string) => ({ what: `@unavailable.${whatKey}` });

export const FUTURE_TOOLS: Tool<Record<string, unknown>, unknown>[] = [
  unavailableTool("sendEmail", "unavailable.notConnectedSuffix", notConnected("outboundEmail")),
  unavailableTool("makePhoneCall", "unavailable.notConnectedSuffix", notConnected("phone")),
  unavailableTool("browserAutomation", "unavailable.notConnectedSuffix", notConnected("browser")),
  unavailableTool("trackShipment", "unavailable.notConnectedSuffix", notConnected("shipment")),
  unavailableTool("connectGmail", "unavailable.notConnectedSuffix", notConnected("gmail")),
  unavailableTool("connectOutlook", "unavailable.notConnectedSuffix", notConnected("outlook")),
  unavailableTool("connectCalendar", "unavailable.notConnectedSuffix", notConnected("calendar")),
  unavailableTool("connectBank", "unavailable.notConnectedSuffix", notConnected("bank")),
  unavailableTool("connectAirline", "unavailable.notConnectedSuffix", notConnected("airline")),
  unavailableTool("connectInsurance", "unavailable.notConnectedSuffix", notConnected("insurance")),
];
