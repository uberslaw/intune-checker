export type ParsedCsv = {
  headers: string[];
  rows: string[][];
  delimiter: "," | ";" | "\t";
};

const SEP_HINT = /^sep\s*=\s*[,;\t]\s*(?:\r?\n)?/i;

export function parseCsv(text: string): ParsedCsv {
  const withoutBom = text.replace(/^\uFEFF/, "");
  const sepMatch = withoutBom.match(SEP_HINT);
  const body = sepMatch ? withoutBom.slice(sepMatch[0].length) : withoutBom;
  if (body.trim() === "") {
    throw new CsvError("This file is empty.");
  }

  const delimiter = detectDelimiter(body);
  const records = parseRecords(body, delimiter).filter((record) =>
    record.some((cell) => cell.trim() !== ""),
  );

  if (records.length === 0) {
    throw new CsvError("This file has no rows.");
  }

  const headers = records[0].map((header) => header.trim());
  if (headers.every((header) => header === "")) {
    throw new CsvError("This file is missing a header row.");
  }

  const rows = records.slice(1).map((record) => {
    const copy = record.slice(0, headers.length);
    while (copy.length < headers.length) copy.push("");
    return copy;
  });

  return { headers, rows, delimiter };
}

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

export function detectDelimiter(text: string): "," | ";" | "\t" {
  const line = firstPhysicalLine(text);
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (char === ",") commas += 1;
    else if (char === ";") semis += 1;
    else if (char === "\t") tabs += 1;
  }

  if (semis > commas && semis >= tabs) return ";";
  if (tabs > commas && tabs > semis) return "\t";
  return ",";
}

function firstPhysicalLine(text: string): string {
  const end = text.search(/\r?\n/);
  return end === -1 ? text : text.slice(0, end);
}

export function parseRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
