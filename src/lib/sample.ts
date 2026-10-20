import { csvEscape } from "./csv";
import { formatUsDateTime, shiftDays } from "./dates";

const DEMO_HEADERS = [
  "Device name",
  "Managed by",
  "Ownership",
  "Compliance",
  "OS",
  "OS version",
  "Last check-in",
  "Primary user UPN",
];

export type DemoBundle = {
  hostnameText: string;
  csv: string;
  label: string;
};

export function buildDemo(now = new Date()): DemoBundle {
  const rows: string[][] = [
    row("PC-FINANCE-01", "Compliant", "Windows", "11", shiftDays(now, 2), "avery.chen@contoso.example"),
    row("PC-FINANCE-01", "Noncompliant", "Windows", "11", shiftDays(now, 90), "old.account@contoso.example"),
    row("LAPTOP-SALES-14", "Noncompliant", "Windows", "11", shiftDays(now, 29), "jordan.lee@contoso.example"),
    row("LAPTOP-SALES-15", "Compliant", "Windows", "10", shiftDays(now, 31), "sam.okonkwo@contoso.example"),
    row("DESKTOP-LAB-03", "In grace period", "Windows", "11", shiftDays(now, 120), "lab.shared@contoso.example"),
    row("WKS-DESIGN-07", "Compliant", "Windows", "11", "", "riley.nguyen@contoso.example"),
    row("KIOSK-NORTH-2", "Compliant", "Windows", "11", "not a date", "kiosk@contoso.example"),
    row("FIELD-TAB-9", "Compliant", "Android", "14", shiftDays(now, 1), "field.tech@contoso.example"),
    row("RECEPTION-PC-01", "Compliant", "Windows", "11", shiftDays(now, 1), "front.desk@contoso.example"),
    row("EXTRA-UNUSED-01", "Compliant", "Windows", "11", shiftDays(now, 3), "unused@contoso.example"),
  ];

  const hostnameText = [
    "pc-finance-01",
    "LAPTOP-SALES-14",
    "LAPTOP-SALES-15",
    "desktop-lab-03",
    "WKS-DESIGN-07",
    "KIOSK-NORTH-2",
    "FIELD-TAB-9",
    "CONF-ROOM-A",
    "  Reception-PC-01  ",
    "pc-finance-01",
  ].join("\n");

  return {
    hostnameText,
    csv: toCsv(rows),
    label: "Demo",
  };
}

export function buildLargeDemo(count = 3000, now = new Date()): DemoBundle {
  const hostnames: string[] = [];
  const rows: string[][] = [];
  const safeCount = Math.max(1, Math.min(count, 20000));

  for (let index = 1; index <= safeCount; index += 1) {
    const name = `WKS-${String(index).padStart(5, "0")}`;
    hostnames.push(name);
    const bucket = index % 4;
    if (bucket === 0) continue;
    if (bucket === 1) {
      rows.push(
        row(name, "Compliant", "Windows", "11", shiftDays(now, 4), `user${index}@contoso.example`),
      );
    } else if (bucket === 2) {
      rows.push(
        row(name, "Compliant", "Windows", "11", shiftDays(now, 80), `user${index}@contoso.example`),
      );
    } else {
      rows.push(row(name, "Compliant", "Windows", "11", "", `user${index}@contoso.example`));
    }
  }

  return {
    hostnameText: hostnames.join("\n"),
    csv: toCsv(rows),
    label: `${safeCount.toLocaleString("en-US")}-name demo`,
  };
}

function row(
  name: string,
  compliance: string,
  os: string,
  osVersion: string,
  checkIn: Date | string,
  user: string,
): string[] {
  const lastCheckIn = checkIn instanceof Date ? formatUsDateTime(checkIn) : checkIn;
  return [name, "Intune", "Corporate", compliance, os, osVersion, lastCheckIn, user];
}

function toCsv(rows: string[][]): string {
  const lines = [DEMO_HEADERS.map(csvEscape).join(",")];
  for (const record of rows) {
    lines.push(record.map(csvEscape).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
