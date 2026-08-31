import { capabilities } from "@/lib/config";
import { GeminiProvider } from "./gemini-provider";
import { HeuristicProvider } from "./heuristic-provider";
import type { AIProvider } from "./provider";

let provider: AIProvider | null = null;

/** Resolves the configured provider, falling back to rule-based structuring. */
export function getAIProvider(): AIProvider {
  if (!provider) {
    provider = capabilities.ai ? new GeminiProvider() : new HeuristicProvider();
  }
  return provider;
}

export function setAIProviderForTesting(next: AIProvider | null): void {
  provider = next;
}

export { HeuristicProvider, GeminiProvider };
export * from "./provider";
export * from "./schemas";
