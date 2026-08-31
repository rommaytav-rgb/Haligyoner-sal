/**
 * Anthropic client wiring.
 *
 * The AI layer is optional: when no credentials are configured the application
 * falls back to deterministic parsing and templated explanations, and every
 * feature still works. Nothing in the product depends on the model being
 * reachable, and no price, percentage or total is ever produced by it.
 */

import Anthropic from '@anthropic-ai/sdk';

export const AI_MODEL = 'claude-opus-5';

let client: Anthropic | null = null;
let clientChecked = false;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function getAiClient(): Anthropic | null {
  if (clientChecked) return client;
  clientChecked = true;
  if (!aiConfigured()) {
    client = null;
    return null;
  }
  client = new Anthropic();
  return client;
}

/** Test seam: lets tests inject a stub or force the no-AI path. */
export function setAiClientForTesting(stub: Anthropic | null): void {
  client = stub;
  clientChecked = true;
}

export function resetAiClient(): void {
  client = null;
  clientChecked = false;
}

/**
 * Wraps untrusted user text so the model treats it as data.
 *
 * Basket text arrives from the user and may contain anything, including
 * instructions aimed at the model. The system prompt tells the model that the
 * delimited block is data; this function makes the boundary unambiguous and
 * strips any closing delimiter the input tries to forge.
 */
export function asUntrustedData(text: string, tag = 'user_text'): string {
  const sanitised = text.replace(new RegExp(`</?${tag}>`, 'gi'), '');
  return `<${tag}>\n${sanitised}\n</${tag}>`;
}

export class AiUnavailableError extends Error {}
