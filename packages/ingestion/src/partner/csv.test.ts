import { describe, expect, it } from 'vitest';
import { parseCsv, rowToRecord } from './csv';

describe('parseCsv', () => {
  it('parses a simple comma-separated file with a header row', () => {
    const { headers, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('supports quoted fields with embedded commas and escaped quotes', () => {
    const { headers, rows } = parseCsv('title,address\n"Two, bedroom flat","Carrer ""Nou"", 5"\n');
    expect(headers).toEqual(['title', 'address']);
    expect(rows).toEqual([['Two, bedroom flat', 'Carrer "Nou", 5']]);
  });

  it('supports quoted fields with embedded newlines', () => {
    const { rows } = parseCsv('title\n"Line one\nLine two"\n');
    expect(rows).toEqual([['Line one\nLine two']]);
  });

  it('handles CRLF line endings and a missing trailing newline', () => {
    const { headers, rows } = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(headers).toEqual(['a', 'b']);
    expect(rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('strips a leading byte-order mark', () => {
    const { headers } = parseCsv('\uFEFFa,b\n1,2\n');
    expect(headers).toEqual(['a', 'b']);
  });
});

describe('rowToRecord', () => {
  it('zips headers and values, defaulting missing cells to empty string', () => {
    expect(rowToRecord(['a', 'b', 'c'], ['1', '2'])).toEqual({ a: '1', b: '2', c: '' });
  });
});
