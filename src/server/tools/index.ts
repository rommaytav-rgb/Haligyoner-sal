import { searchWeb, searchOfficialSource, fetchWebPage } from "./web";
import { extractDocumentText, analyzeImage, compareDocuments } from "./documents";
import {
  addFactTool,
  addTaskTool,
  addTimelineEventTool,
  createDraftTool,
  prepareFormTool,
  updateCaseStatusTool,
  updateCaseTool,
} from "./case-tools";
import { FUTURE_TOOLS } from "./future";
import type { Tool } from "./types";

/** Everything the orchestrator may reach for, connected or not. */
const REGISTRY = new Map<string, Tool<never, unknown>>();

function register(tool: Tool<never, unknown>) {
  REGISTRY.set(tool.name, tool);
}

for (const tool of [
  searchWeb,
  searchOfficialSource,
  fetchWebPage,
  extractDocumentText,
  analyzeImage,
  compareDocuments,
  addFactTool,
  addTimelineEventTool,
  addTaskTool,
  updateCaseStatusTool,
  updateCaseTool,
  createDraftTool,
  prepareFormTool,
  ...FUTURE_TOOLS,
] as unknown as Tool<never, unknown>[]) {
  register(tool);
}

export function getTool(name: string): Tool<never, unknown> | undefined {
  return REGISTRY.get(name);
}

export function isToolAvailable(name: string): boolean {
  return REGISTRY.get(name)?.available ?? false;
}

export interface ToolSummary {
  name: string;
  /** Catalogue keys; the Settings screen renders them in the reader's language. */
  descriptionKey: string;
  available: boolean;
  unavailableKey?: string;
  unavailableParams?: Record<string, string | number>;
}

/** Powers the Settings screen, so users can see exactly what is connected. */
export function listTools(): ToolSummary[] {
  return [...REGISTRY.values()].map((tool) => ({
    name: tool.name,
    descriptionKey: tool.descriptionKey,
    available: tool.available,
    unavailableKey: tool.unavailableKey,
    unavailableParams: tool.unavailableParams,
  }));
}

export * from "./types";
export { searchWeb, searchOfficialSource, fetchWebPage, extractDocumentText, compareDocuments };
