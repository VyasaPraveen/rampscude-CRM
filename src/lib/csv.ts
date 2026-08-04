/** Parse a simple CSV (handles quoted fields with commas and escaped quotes) into rows of cells. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Pick a column index: exact header match wins, then a substring match — most specific key first. */
export function pickColumn(header: string[], keys: string[]): number {
  for (const key of keys) {
    const exact = header.indexOf(key);
    if (exact >= 0) return exact;
  }
  for (const key of keys) {
    const partial = header.findIndex((h) => h.includes(key));
    if (partial >= 0) return partial;
  }
  return -1;
}
