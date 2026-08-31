/**
 * Minimal XML reader for the Israeli price-transparency files.
 *
 * The published files are flat, attribute-light documents (PriceFull / PromoFull
 * / Stores). A focused parser keeps the ingest path dependency-free and lets us
 * parse fixture files in tests without network access.
 *
 * It is deliberately not a general XML processor: no namespaces, no DTDs, no
 * entity definitions beyond the five predefined ones plus numeric references.
 */

export interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

export class XmlParseError extends Error {}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return ENTITIES[body] ?? match;
  });
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const key = match[1];
    const value = match[3] ?? match[4] ?? '';
    if (key) attributes[key] = decodeEntities(value);
  }
  return attributes;
}

/** Parses an XML document and returns its root element. */
export function parseXml(source: string): XmlNode {
  const stack: XmlNode[] = [];
  let root: XmlNode | null = null;
  let index = 0;
  const length = source.length;

  while (index < length) {
    const open = source.indexOf('<', index);
    if (open === -1) break;

    if (open > index) {
      const text = source.slice(index, open);
      const current = stack[stack.length - 1];
      if (current && text.trim().length > 0) current.text += decodeEntities(text);
    }

    // Comments, declarations, doctypes and CDATA.
    if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open);
      if (end === -1) throw new XmlParseError('Unterminated comment');
      index = end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', open)) {
      const end = source.indexOf(']]>', open);
      if (end === -1) throw new XmlParseError('Unterminated CDATA section');
      const current = stack[stack.length - 1];
      if (current) current.text += source.slice(open + 9, end);
      index = end + 3;
      continue;
    }
    if (source.startsWith('<?', open) || source.startsWith('<!', open)) {
      const end = source.indexOf('>', open);
      if (end === -1) throw new XmlParseError('Unterminated processing instruction');
      index = end + 1;
      continue;
    }

    const close = source.indexOf('>', open);
    if (close === -1) throw new XmlParseError('Unterminated tag');
    const raw = source.slice(open + 1, close).trim();

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const current = stack.pop();
      if (!current) throw new XmlParseError(`Unexpected closing tag </${name}>`);
      if (current.name !== name) {
        throw new XmlParseError(`Mismatched closing tag: expected </${current.name}>, got </${name}>`);
      }
      index = close + 1;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const spaceAt = body.search(/\s/);
    const name = spaceAt === -1 ? body : body.slice(0, spaceAt);
    const attributes = spaceAt === -1 ? {} : parseAttributes(body.slice(spaceAt));
    const node: XmlNode = { name, attributes, children: [], text: '' };

    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else if (!root) root = node;

    if (!selfClosing) stack.push(node);
    index = close + 1;
  }

  if (stack.length > 0) throw new XmlParseError(`Unclosed tag <${stack[stack.length - 1]?.name}>`);
  if (!root) throw new XmlParseError('Document contains no root element');
  return root;
}

/** All direct children with the given name, matched case-insensitively. */
export function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  const target = name.toLowerCase();
  return node.children.filter((child) => child.name.toLowerCase() === target);
}

/** First descendant with the given name, breadth-first. */
export function findFirst(node: XmlNode, name: string): XmlNode | null {
  const target = name.toLowerCase();
  const queue: XmlNode[] = [node];
  while (queue.length > 0) {
    const current = queue.shift() as XmlNode;
    if (current !== node && current.name.toLowerCase() === target) return current;
    queue.push(...current.children);
  }
  return null;
}

/** Text of the first child with the given name, trimmed. */
export function textOf(node: XmlNode, name: string): string | null {
  const child = childrenNamed(node, name)[0] ?? findFirst(node, name);
  if (!child) return null;
  const value = child.text.trim();
  return value.length > 0 ? value : null;
}
