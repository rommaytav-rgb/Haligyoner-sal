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
  description: string;
  available: boolean;
  unavailableReason?: string;
}

/** Powers the Settings screen, so users can see exactly what is connected. */
export function listTools(): ToolSummary[] {
  return [...REGISTRY.values()].map((t) => ({
    name: t.name,
    description: t.description,
    available: t.available,
    unavailableReason: t.unavailableReason,
  }));
}

export * from "./types";
export { searchWeb, searchOfficialSource, fetchWebPage, extractDocumentText, compareDocuments };
