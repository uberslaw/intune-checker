import { selectColumns } from "./columns";
import { parseCsv } from "./csv";
import { cutoffFrom, daysSince, parseCheckIn } from "./dates";
import { normalizeName } from "./hostnames";
import type {
  CheckResult,
  ColumnSelection,
  DateOrder,
  DeviceRow,
  MatchSummary,
  ReasonCode,
  ReasonCounts,
} from "./types";

const EMPTY_REASONS = (): ReasonCounts => ({
  "within-window": 0,
  "future-checkin": 0,
  "no-match": 0,
  "outside-window": 0,
  "missing-checkin": 0,
  "unreadable-checkin": 0,
});

export function isWindowsOs(os: string): boolean {
  const value = os.trim().toLowerCase();
  if (!value) return true;
  return value.includes("windows") || value === "win" || /^win(?:10|11|32)$/.test(value);
}

export function devicesFromCsv(
  text: string,
  dateOrder: DateOrder,
): {
  devices: DeviceRow[];
  columns: ColumnSelection;
  dataRows: number;
  headers: string[];
} {
  const parsed = parseCsv(text);
  const columns = selectColumns(parsed.headers);
  if (!columns.deviceName) {
    return {
      devices: [],
      columns,
      dataRows: parsed.rows.length,
      headers: parsed.headers,
    };
  }

  const devices: DeviceRow[] = [];
  for (const row of parsed.rows) {
    const deviceName = (row[columns.deviceName.index] ?? "").trim();
    if (!deviceName) continue;
    const lastCheckInRaw = columns.lastCheckIn
      ? (row[columns.lastCheckIn.index] ?? "").trim()
      : "";
    devices.push({
      deviceName,
      lastCheckInRaw,
      lastCheckIn: columns.lastCheckIn ? parseCheckIn(lastCheckInRaw, dateOrder) : null,
      compliance: columns.compliance ? (row[columns.compliance.index] ?? "").trim() : "",
      primaryUser: columns.primaryUser
        ? (row[columns.primaryUser.index] ?? "").trim()
        : "",
      os: columns.os ? (row[columns.os.index] ?? "").trim() : "",
    });
  }

  return {
    devices,
    columns,
    dataRows: parsed.rows.length,
    headers: parsed.headers,
  };
}

export function matchHostnames(input: {
  hostnames: string[];
  devices: DeviceRow[];
  windowDays: number;
  checkedAt: Date;
  hasOsColumn: boolean;
}): { results: CheckResult[]; summary: MatchSummary } {
  const cutoff = cutoffFrom(input.checkedAt, input.windowDays);
  const { index, duplicateDeviceNames } = indexDevices(
    input.devices,
    input.hasOsColumn,
  );
  const reasons = EMPTY_REASONS();
  const results: CheckResult[] = [];

  for (const hostname of input.hostnames) {
    const device = index.get(normalizeName(hostname));
    const result = device
      ? resultFromDevice(hostname, device, input.checkedAt, input.windowDays, cutoff)
      : noMatch(hostname);
    reasons[result.reasonCode] += 1;
    results.push(result);
  }

  const active = results.filter((result) => result.status === "active").length;
  return {
    results,
    summary: {
      lookedUp: results.length,
      active,
      inactive: results.length - active,
      windowDays: input.windowDays,
      checkedAt: input.checkedAt,
      cutoff,
      duplicateDeviceNames,
      reasons,
    },
  };
}

function indexDevices(
  devices: DeviceRow[],
  hasOsColumn: boolean,
): { index: Map<string, DeviceRow>; duplicateDeviceNames: number } {
  const index = new Map<string, DeviceRow>();
  const extras = new Map<string, number>();

  for (const device of devices) {
    if (hasOsColumn && !isWindowsOs(device.os)) continue;
    const key = normalizeName(device.deviceName);
    if (!key) continue;
    const current = index.get(key);
    if (!current) {
      index.set(key, device);
      continue;
    }
    extras.set(key, (extras.get(key) ?? 0) + 1);
    if (isNewer(device, current)) index.set(key, device);
  }

  return { index, duplicateDeviceNames: extras.size };
}

function isNewer(candidate: DeviceRow, current: DeviceRow): boolean {
  if (candidate.lastCheckIn && current.lastCheckIn) {
    return candidate.lastCheckIn.getTime() > current.lastCheckIn.getTime();
  }
  return Boolean(candidate.lastCheckIn) && !current.lastCheckIn;
}

function noMatch(hostname: string): CheckResult {
  return {
    hostname,
    status: "inactive",
    reasonCode: "no-match",
    reason: "No matching Windows device in the export.",
    deviceName: "",
    lastCheckInRaw: "",
    lastCheckIn: null,
    daysSinceCheckIn: null,
    compliance: "",
    primaryUser: "",
    os: "",
  };
}

function resultFromDevice(
  hostname: string,
  device: DeviceRow,
  checkedAt: Date,
  windowDays: number,
  cutoff: Date,
): CheckResult {
  const base = {
    hostname,
    deviceName: device.deviceName,
    lastCheckInRaw: device.lastCheckInRaw,
    lastCheckIn: device.lastCheckIn,
    daysSinceCheckIn: device.lastCheckIn ? daysSince(checkedAt, device.lastCheckIn) : null,
    compliance: device.compliance,
    primaryUser: device.primaryUser,
    os: device.os,
  };

  if (!device.lastCheckIn) {
    const unreadable = device.lastCheckInRaw.trim() !== "";
    const reasonCode: ReasonCode = unreadable ? "unreadable-checkin" : "missing-checkin";
    return {
      ...base,
      status: "inactive",
      reasonCode,
      reason: unreadable
        ? `Last check-in “${device.lastCheckInRaw.trim()}” could not be read, so it counts as missing.`
        : "Last check-in is missing.",
    };
  }

  if (device.lastCheckIn.getTime() >= cutoff.getTime()) {
    const future = device.lastCheckIn.getTime() > checkedAt.getTime();
    return {
      ...base,
      status: "active",
      reasonCode: future ? "future-checkin" : "within-window",
      reason: future
        ? "Last check-in is dated in the future, so it counts as active."
        : `Checked in within the ${windowDays}-day window.`,
    };
  }

  return {
    ...base,
    status: "inactive",
    reasonCode: "outside-window",
    reason: `Last check-in is outside the ${windowDays}-day window.`,
  };
}
