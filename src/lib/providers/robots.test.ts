import { describe, expect, it } from 'vitest';
import { isAllowed, parseRobots } from './robots';

const robots = `
# Portal robots
User-agent: *
Disallow: /private
Crawl-delay: 5

User-agent: ShoppingOptimizerBot
Disallow: /admin
Allow: /admin/public
`;

describe('parseRobots', () => {
  it('prefers an exact user-agent group over the wildcard group', () => {
    const rules = parseRobots(robots, 'ShoppingOptimizerBot');
    expect(rules.disallow).toEqual(['/admin']);
    expect(rules.allow).toEqual(['/admin/public']);
  });

  it('falls back to the wildcard group', () => {
    const rules = parseRobots(robots, 'SomeOtherBot');
    expect(rules.disallow).toEqual(['/private']);
    expect(rules.crawlDelaySeconds).toBe(5);
  });

  it('returns empty rules for a file with no groups', () => {
    expect(parseRobots('', 'Bot').disallow).toEqual([]);
  });

  it('ignores comments', () => {
    expect(parseRobots('User-agent: *\nDisallow: /x # note', 'Bot').disallow).toEqual(['/x']);
  });
});

describe('isAllowed', () => {
  const rules = parseRobots(robots, 'ShoppingOptimizerBot');

  it('blocks a disallowed prefix', () => {
    expect(isAllowed(rules, '/admin/secret')).toBe(false);
  });

  it('lets a longer Allow override a Disallow', () => {
    expect(isAllowed(rules, '/admin/public/list')).toBe(true);
  });

  it('allows anything not covered', () => {
    expect(isAllowed(rules, '/files/PriceFull.gz')).toBe(true);
  });

  it('treats a bare Disallow: / as blocking everything', () => {
    const blockAll = parseRobots('User-agent: *\nDisallow: /', 'Bot');
    expect(isAllowed(blockAll, '/anything')).toBe(false);
  });
});
