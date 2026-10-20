import { csvEscape } from "./csv";
import { formatStampForCsv } from "./dates";
import type { CheckResult } from "./types";

export function resultsToCsv(results: CheckResult[]): string {
  const headers = [
    "Hostname",
    "Status",
    "Device name",
    "Last check-in",
    "Days since check-in",
    "Compliance",
    "Primary user",
    "OS",
    "Reason",
  ];
  const lines = [headers.join(",")];
  for (const result of results) {
    lines.push(
      [
        result.hostname,
        result.status === "active" ? "Active" : "Inactive",
        result.deviceName,
        result.lastCheckIn ? formatStampForCsv(result.lastCheckIn) : "",
        result.daysSinceCheckIn === null ? "" : String(result.daysSinceCheckIn),
        result.compliance,
        result.primaryUser,
        result.os,
        result.reason,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function resultsFilename(checkedAt: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${checkedAt.getFullYear()}${pad(checkedAt.getMonth() + 1)}${pad(checkedAt.getDate())}-${pad(checkedAt.getHours())}${pad(checkedAt.getMinutes())}`;
  return `intune-checker-results-${stamp}.csv`;
}
