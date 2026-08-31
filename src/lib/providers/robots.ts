/**
 * robots.txt parsing and enforcement.
 *
 * The product rule is explicit: no blind automated fetching. Before any live
 * ingest run touches a publishing portal, the crawl path is checked against that
 * host's robots.txt and the configured crawl delay is honoured. A portal that
 * disallows the path is skipped and reported, never fetched anyway.
 */

export interface RobotsRules {
  /** Path prefixes disallowed for our user-agent (or `*`). */
  disallow: string[];
  allow: string[];
  crawlDelaySeconds: number | null;
}

export const EMPTY_ROBOTS: RobotsRules = { disallow: [], allow: [], crawlDelaySeconds: null };

/**
 * Parses robots.txt, taking the most specific matching group: an exact
 * user-agent match wins over the `*` group.
 */
export function parseRobots(source: string, userAgent: string): RobotsRules {
  const agent = userAgent.toLowerCase();
  const groups: Array<{ agents: string[]; rules: RobotsRules }> = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (line.length === 0) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastLineWasAgent) {
        current = { agents: [], rules: { disallow: [], allow: [], crawlDelaySeconds: null } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }
    lastLineWasAgent = false;
    if (!current) continue;

    if (field === 'disallow' && value.length > 0) current.rules.disallow.push(value);
    else if (field === 'allow' && value.length > 0) current.rules.allow.push(value);
    else if (field === 'crawl-delay') {
      const delay = Number.parseFloat(value);
      if (Number.isFinite(delay)) current.rules.crawlDelaySeconds = delay;
    }
  }

  const exact = groups.find((g) => g.agents.includes(agent));
  if (exact) return exact.rules;
  const wildcard = groups.find((g) => g.agents.includes('*'));
  return wildcard ? wildcard.rules : EMPTY_ROBOTS;
}

/** Longest-match wins, with Allow beating Disallow at equal length (RFC 9309). */
export function isAllowed(rules: RobotsRules, pathname: string): boolean {
  let bestDisallow = -1;
  let bestAllow = -1;
  for (const rule of rules.disallow) {
    if (pathname.startsWith(rule) && rule.length > bestDisallow) bestDisallow = rule.length;
  }
  for (const rule of rules.allow) {
    if (pathname.startsWith(rule) && rule.length > bestAllow) bestAllow = rule.length;
  }
  if (bestDisallow === -1) return true;
  return bestAllow >= bestDisallow;
}
