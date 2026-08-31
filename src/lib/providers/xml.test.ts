import { describe, expect, it } from 'vitest';
import { childrenNamed, decodeEntities, findFirst, parseXml, textOf, XmlParseError } from './xml';

const sample = `<?xml version="1.0" encoding="utf-8"?>
<Root>
  <ChainId>7290058140886</ChainId>
  <SubChainId>001</SubChainId>
  <Items Count="2">
    <Item>
      <ItemCode>7290000123456</ItemCode>
      <ItemName>חלב תנובה 3% 1 ליטר</ItemName>
      <ItemPrice>6.90</ItemPrice>
      <UnitOfMeasure>ליטר</UnitOfMeasure>
    </Item>
    <Item>
      <ItemCode>7290000999999</ItemCode>
      <ItemName><![CDATA[Coffee & Cream 200g]]></ItemName>
      <ItemPrice>24.90</ItemPrice>
      <Empty/>
    </Item>
  </Items>
</Root>`;

describe('parseXml', () => {
  it('parses a transparency-style document', () => {
    const root = parseXml(sample);
    expect(root.name).toBe('Root');
    expect(textOf(root, 'ChainId')).toBe('7290058140886');
    const items = childrenNamed(findFirst(root, 'Items') as never, 'Item');
    expect(items).toHaveLength(2);
    expect(textOf(items[0] as never, 'ItemName')).toBe('חלב תנובה 3% 1 ליטר');
    expect(textOf(items[0] as never, 'ItemPrice')).toBe('6.90');
  });

  it('reads attributes', () => {
    const root = parseXml(sample);
    expect(findFirst(root, 'Items')?.attributes.Count).toBe('2');
  });

  it('handles CDATA and self-closing elements', () => {
    const root = parseXml(sample);
    const items = childrenNamed(findFirst(root, 'Items') as never, 'Item');
    expect(textOf(items[1] as never, 'ItemName')).toBe('Coffee & Cream 200g');
    expect(textOf(items[1] as never, 'Empty')).toBeNull();
  });

  it('decodes entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &#65; &#x42;')).toBe('a & b <c> A B');
  });

  it('rejects malformed documents instead of guessing', () => {
    expect(() => parseXml('<a><b></a>')).toThrow(XmlParseError);
    expect(() => parseXml('<a>')).toThrow(XmlParseError);
    expect(() => parseXml('no xml here')).toThrow(XmlParseError);
  });

  it('ignores comments and declarations', () => {
    const root = parseXml('<?xml version="1.0"?><!-- note --><a><b>1</b></a>');
    expect(textOf(root, 'b')).toBe('1');
  });
});
