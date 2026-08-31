import { capabilities, config } from "@/lib/config";
import { log } from "@/lib/logger";
import { fenceUntrusted } from "@/server/ai/sanitize";
import type { ResearchSourceType } from "@/domain/types";
import type { Tool } from "./types";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  sourceType: ResearchSourceType;
}

const RESEARCH_UNAVAILABLE_KEY = "unavailable.research";

/** Classifies a result by its host so official sources can be preferred (section 27). */
export function classifySource(url: string): ResearchSourceType {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "SECONDARY";
  }
  if (/\.(gov|gov\.[a-z]{2}|mil)$/.test(host) || host.includes(".gov.")) return "GOVERNMENT";
  if (/(ombudsman|regulator|authority|commission|fca\.|ftc\.|cfpb\.)/.test(host)) return "REGULATOR";
  if (/(support|help|policy|policies|legal|terms)\./.test(host)) return "POLICY";
  if (/\.(org|edu)$/.test(host)) return "OFFICIAL";
  return "SECONDARY";
}

async function runSearch(query: string, restrict?: string): Promise<SearchHit[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", config.searchApiKey!);
  url.searchParams.set("cx", config.searchEngineId!);
  url.searchParams.set("q", restrict ? `${query} ${restrict}` : query);
  url.searchParams.set("num", "5");

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`search responded ${response.status}`);

  const payload = (await response.json()) as { items?: { title?: string; link?: string; snippet?: string }[] };
  return (payload.items ?? [])
    .filter((item): item is { title: string; link: string; snippet?: string } => Boolean(item.title && item.link))
    .map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet ?? "",
      sourceType: classifySource(item.link),
    }));
}

export const searchWeb: Tool<{ query: string }, SearchHit[]> = {
  name: "searchWeb",
  descriptionKey: "tools.searchWeb.description",
  available: capabilities.webResearch,
  unavailableKey: capabilities.webResearch ? undefined : RESEARCH_UNAVAILABLE_KEY,
  requiresApproval: false,
  async run({ query }) {
    if (!capabilities.webResearch) return { ok: false, reason: "UNAVAILABLE", messageKey: RESEARCH_UNAVAILABLE_KEY };
    try {
      const hits = await runSearch(query);
      log.info({ event: "tool.searchWeb", outcome: "ok", results: hits.length });
      return { ok: true, data: hits };
    } catch (error) {
      log.error({ event: "tool.searchWeb", outcome: "error", error });
      return { ok: false, reason: "FAILED", messageKey: "unavailable.researchFailed" };
    }
  },
};

export const searchOfficialSource: Tool<{ query: string }, SearchHit[]> = {
  name: "searchOfficialSource",
  descriptionKey: "tools.searchOfficialSource.description",
  available: capabilities.webResearch,
  unavailableKey: capabilities.webResearch ? undefined : RESEARCH_UNAVAILABLE_KEY,
  requiresApproval: false,
  async run({ query }) {
    if (!capabilities.webResearch) return { ok: false, reason: "UNAVAILABLE", messageKey: RESEARCH_UNAVAILABLE_KEY };
    try {
      const hits = await runSearch(query, "site:.gov OR site:.org OR official policy");
      const ranked = [...hits].sort((a, b) => rank(a.sourceType) - rank(b.sourceType));
      return { ok: true, data: ranked };
    } catch (error) {
      log.error({ event: "tool.searchOfficialSource", outcome: "error", error });
      return { ok: false, reason: "FAILED", messageKey: "unavailable.researchFailed" };
    }
  },
};

function rank(type: ResearchSourceType): number {
  return { OFFICIAL: 1, GOVERNMENT: 0, REGULATOR: 2, POLICY: 3, SECONDARY: 4 }[type];
}

export const fetchWebPage: Tool<{ url: string }, { url: string; text: string; suspicious: boolean }> = {
  name: "fetchWebPage",
  descriptionKey: "tools.fetchWebPage.description",
  available: true,
  requiresApproval: false,
  async run({ url }) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: "FAILED", messageKey: "unavailable.researchFailed" };
    }
    // Only public HTTP(S); this must never be usable to reach internal metadata endpoints.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, reason: "NOT_PERMITTED", messageKey: "unavailable.researchFailed" };
    }
    if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[?::1)/.test(parsed.hostname)) {
      return { ok: false, reason: "NOT_PERMITTED", messageKey: "unavailable.researchFailed" };
    }

    try {
      const response = await fetch(parsed, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return { ok: false, reason: "FAILED", messageKey: "unavailable.researchFailed" };
      const html = (await response.text()).slice(0, 400_000);
      const text = htmlToText(html);
      const fenced = fenceUntrusted("WEB_PAGE", text, 8000);
      return { ok: true, data: { url: parsed.toString(), text: fenced.prompt, suspicious: fenced.suspicious } };
    } catch (error) {
      log.error({ event: "tool.fetchWebPage", outcome: "error", error });
      return { ok: false, reason: "FAILED", messageKey: "unavailable.researchFailed" };
    }
  },
};

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
