import { detectDelimiter, parseRecords } from "./csv";
import { normalizeHeader } from "./columns";

const HOSTNAME_HEADER_KEYS = new Set(
  [
    "hostname",
    "host name",
    "device name",
    "computer name",
    "computer",
    "device",
    "name",
    "machine",
    "machine name",
    "pc name",
  ].map((alias) => alias.replace(/ /g, "")),
);

export type HostnameParse = {
  hostnames: string[];
  duplicateCount: number;
  note: string | null;
};

export function normalizeName(value: string): string {
  return value.replace(/^\uFEFF/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseHostnameList(text: string): HostnameParse {
  const source = text.replace(/^\uFEFF/, "");
  if (source.trim() === "") {
    return { hostnames: [], duplicateCount: 0, note: null };
  }

  const delimiter = hasDelimiter(source) ? detectDelimiter(source) : null;
  let cells: string[] = [];
  let note: string | null = null;

  if (!delimiter) {
    cells = source.split(/\r?\n/);
    if (cells.length > 0 && isHostnameHeader(cells[0] ?? "")) {
      cells = cells.slice(1);
      note = "Skipped a header row in the hostname list.";
    }
  } else {
    const records = parseRecords(source, delimiter).filter((record) =>
      record.some((cell) => cell.trim() !== ""),
    );
    if (records.length === 0) {
      return { hostnames: [], duplicateCount: 0, note: null };
    }

    const headerIndex = records[0].findIndex((cell) => isHostnameHeader(cell));
    const singleColumn = records.every((record) => record.length <= 1);

    if (headerIndex !== -1) {
      cells = records.slice(1).map((record) => record[headerIndex] ?? "");
      note = `Read hostnames from the “${records[0][headerIndex]?.trim()}” column.`;
    } else if (singleColumn) {
      cells = records.map((record) => record[0] ?? "");
    } else if (records.length === 1) {
      cells = records[0];
    } else {
      cells = records.map((record) => record[0] ?? "");
      note = "Used the first column of this list. Add a Hostname header if the names are in another column.";
    }
  }

  const seen = new Set<string>();
  const hostnames: string[] = [];
  let duplicateCount = 0;

  for (const cell of cells) {
    const cleaned = stripWrappingQuotes(cell).trim();
    if (!cleaned || cleaned.startsWith("#")) continue;
    if (cleaned.length > 255) continue;
    const key = normalizeName(cleaned);
    if (!key) continue;
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    hostnames.push(cleaned.trim());
  }

  return { hostnames, duplicateCount, note };
}

function hasDelimiter(text: string): boolean {
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  return /[,;\t]/.test(line);
}

function isHostnameHeader(value: string): boolean {
  const key = normalizeHeader(value).replace(/ /g, "");
  return HOSTNAME_HEADER_KEYS.has(key);
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
