import type { ColumnSelection, HeaderHit } from "./types";

const DEVICE_NAME_ALIASES = [
  "device name",
  "computer name",
  "host name",
  "hostname",
  "managed device name",
  "device display name",
  "device",
  "name",
];

const LAST_CHECK_IN_ALIASES = [
  "last check in",
  "last check in time",
  "last check in date",
  "last check in date time",
  "last sync date time",
  "last sync",
  "last contact",
  "last online",
];

const COMPLIANCE_ALIASES = [
  "compliance",
  "compliance state",
  "compliance status",
  "device compliance",
];

const PRIMARY_USER_ALIASES = [
  "primary user upn",
  "user principal name",
  "primary user email address",
  "primary user email",
  "upn",
  "primary user",
  "primary user display name",
  "user display name",
];

const OS_ALIASES = ["os", "operating system", "os description", "platform"];

export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_./]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return value.replace(/ /g, "");
}

export function findHeader(headers: string[], aliases: string[]): HeaderHit | null {
  const keys = headers.map((header) => compact(normalizeHeader(header)));
  for (const alias of aliases) {
    const index = keys.indexOf(compact(alias));
    if (index !== -1) {
      return { index, header: headers[index] ?? "" };
    }
  }
  return null;
}

export function selectColumns(headers: string[]): ColumnSelection {
  return {
    deviceName: findHeader(headers, DEVICE_NAME_ALIASES),
    lastCheckIn: findHeader(headers, LAST_CHECK_IN_ALIASES),
    compliance: findHeader(headers, COMPLIANCE_ALIASES),
    primaryUser: findHeader(headers, PRIMARY_USER_ALIASES),
    os: findHeader(headers, OS_ALIASES),
  };
}

export function columnSummary(columns: ColumnSelection): string {
  const used = [
    columns.deviceName,
    columns.lastCheckIn,
    columns.compliance,
    columns.primaryUser,
    columns.os,
  ].filter((hit): hit is HeaderHit => hit !== null);

  if (used.length === 0) return "No recognized columns.";
  if (used.length === 1) return `Using “${used[0].header}”.`;
  const labels = used.map((hit) => `“${hit.header}”`);
  const last = labels.pop();
  return `Using ${labels.join(", ")}, and ${last}.`;
}
