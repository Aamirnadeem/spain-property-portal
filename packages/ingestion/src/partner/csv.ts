/**
 * Minimal RFC 4180-ish CSV parser (no external dependency). Supports quoted fields with
 * embedded commas/newlines/escaped double-quotes, and both CRLF and LF line endings.
 */
export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const source = text.replace(/^\uFEFF/, ''); // strip BOM if present

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < source.length) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ''));
  const [headerRow, ...dataRows] = nonEmptyRows;
  return { headers: headerRow ?? [], rows: dataRows };
}

/** Zips a header row with a data row into a raw string record, ignoring extra/missing cells. */
export function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header.trim()] = row[index] ?? '';
  });
  return record;
}
