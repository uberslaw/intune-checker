import assert from "node:assert/strict";
import { test } from "node:test";
import { selectColumns } from "../src/lib/columns";
import { parseCsv } from "../src/lib/csv";
import { cutoffFrom, parseCheckIn, parseWindowDays } from "../src/lib/dates";
import { decodeSpreadsheetText } from "../src/lib/decode";
import { parseHostnameList } from "../src/lib/hostnames";
import { devicesFromCsv, isWindowsOs, matchHostnames } from "../src/lib/match";
import { resultsToCsv } from "../src/lib/results-csv";
import { buildDemo, buildLargeDemo } from "../src/lib/sample";

const NOW = new Date(2026, 9, 20, 12, 0, 0);

test("demo list follows the active and inactive rules", () => {
  const demo = buildDemo(NOW);
  const parsed = parseHostnameList(demo.hostnameText);
  assert.equal(parsed.duplicateCount, 1);
  assert.equal(parsed.hostnames.length, 9);
  assert.equal(parsed.hostnames.at(-1), "Reception-PC-01");

  const built = devicesFromCsv(demo.csv, "mdy");
  assert.ok(built.columns.deviceName);
  assert.equal(built.columns.deviceName?.header, "Device name");
  assert.equal(built.columns.primaryUser?.header, "Primary user UPN");
  assert.equal(built.columns.compliance?.header, "Compliance");

  const { results, summary } = matchHostnames({
    hostnames: parsed.hostnames,
    devices: built.devices,
    windowDays: 30,
    checkedAt: NOW,
    hasOsColumn: true,
  });

  const byName = Object.fromEntries(results.map((result) => [result.hostname, result]));
  assert.equal(byName["pc-finance-01"].status, "active");
  assert.equal(byName["pc-finance-01"].primaryUser, "avery.chen@contoso.example");
  assert.equal(byName["pc-finance-01"].deviceName, "PC-FINANCE-01");
  assert.equal(byName["LAPTOP-SALES-14"].status, "active");
  assert.equal(byName["LAPTOP-SALES-14"].compliance, "Noncompliant");
  assert.equal(byName["LAPTOP-SALES-15"].status, "inactive");
  assert.equal(byName["LAPTOP-SALES-15"].reasonCode, "outside-window");
  assert.equal(byName["desktop-lab-03"].reasonCode, "outside-window");
  assert.equal(byName["WKS-DESIGN-07"].reasonCode, "missing-checkin");
  assert.equal(byName["KIOSK-NORTH-2"].reasonCode, "unreadable-checkin");
  assert.equal(byName["FIELD-TAB-9"].reasonCode, "no-match");
  assert.equal(byName["CONF-ROOM-A"].reasonCode, "no-match");
  assert.equal(byName["Reception-PC-01"].status, "active");
  assert.equal(summary.active, 3);
  assert.equal(summary.inactive, 6);
  assert.equal(summary.lookedUp, 9);
  assert.equal(summary.duplicateDeviceNames, 1);

  const wider = matchHostnames({
    hostnames: parsed.hostnames,
    devices: built.devices,
    windowDays: 40,
    checkedAt: NOW,
    hasOsColumn: true,
  });
  const sales = wider.results.find((result) => result.hostname === "LAPTOP-SALES-15");
  assert.equal(sales?.status, "active");
  assert.equal(wider.summary.active, 4);
});

test("the cutoff instant is active and one millisecond later is inactive", () => {
  const checkedAt = NOW;
  const cutoff = cutoffFrom(checkedAt, 30);
  const csv = [
    "Device name,OS,Last check-in",
    `EDGE-ON,Windows,${stamp(cutoff)}`,
    `EDGE-OFF,Windows,${stamp(new Date(cutoff.getTime() - 1))}`,
  ].join("\n");
  const built = devicesFromCsv(csv, "mdy");
  const { results } = matchHostnames({
    hostnames: ["edge-on", "edge-off"],
    devices: built.devices,
    windowDays: 30,
    checkedAt,
    hasOsColumn: true,
  });
  assert.equal(results[0].status, "active");
  assert.equal(results[0].reasonCode, "within-window");
  assert.equal(results[1].status, "inactive");
  assert.equal(results[1].reasonCode, "outside-window");
});

test("alternate Intune headers, quoted commas, and a non-windows twin", () => {
  const csv = [
    "Computer name,Compliance state,Operating system,Primary user display name,Last sync date time,Primary user UPN",
    "PC-01,Compliant,Windows,\"Chen, Avery\",2026-10-01 09:30,avery@contoso.example",
    "PC-01,Compliant,Android,\"Chen, Avery\",2026-10-19 09:30,phone@contoso.example",
    "PC-02,See ConfigMgr,Windows 11 Enterprise,Lab bench,,",
  ].join("\n");
  const built = devicesFromCsv(csv, "mdy");
  assert.equal(built.columns.deviceName?.header, "Computer name");
  assert.equal(built.columns.lastCheckIn?.header, "Last sync date time");
  assert.equal(built.columns.compliance?.header, "Compliance state");
  assert.equal(built.columns.primaryUser?.header, "Primary user UPN");
  assert.equal(built.columns.os?.header, "Operating system");

  const { results } = matchHostnames({
    hostnames: ["pc-01", "pc-02"],
    devices: built.devices,
    windowDays: 30,
    checkedAt: NOW,
    hasOsColumn: true,
  });
  assert.equal(results[0].status, "active");
  assert.equal(results[0].primaryUser, "avery@contoso.example");
  assert.equal(results[1].reasonCode, "missing-checkin");
  assert.equal(results[1].compliance, "See ConfigMgr");
});

test("semicolon exports, BOM, sep hint, and day-first dates", () => {
  const csv = "\uFEFFsep=;\nDevice name;Last check-in;OS\nPC-EU;31/08/2026 8:05 AM;Windows\n";
  const built = devicesFromCsv(csv, "dmy");
  assert.equal(built.devices.length, 1);
  const parsed = built.devices[0].lastCheckIn;
  assert.ok(parsed);
  assert.equal(parsed?.getFullYear(), 2026);
  assert.equal(parsed?.getMonth(), 7);
  assert.equal(parsed?.getDate(), 31);

  const us = devicesFromCsv(
    "Device name,Last check-in,OS\nPC-US,08/31/2026 8:05 AM,Windows\n",
    "mdy",
  );
  assert.equal(us.devices[0].lastCheckIn?.getMonth(), 7);
  assert.equal(us.devices[0].lastCheckIn?.getDate(), 31);

  const named = parseCheckIn("Oct 1, 2026, 9:41 AM", "dmy");
  assert.equal(named?.getMonth(), 9);
  assert.equal(named?.getDate(), 1);
  assert.equal(named?.getHours(), 9);
});

test("a missing device name column is reported without inventing matches", () => {
  const built = devicesFromCsv("Compliance,OS\nCompliant,Windows\n", "mdy");
  assert.equal(built.columns.deviceName, null);
  assert.equal(built.devices.length, 0);
});

test("hostname CSV column and comments", () => {
  const parsed = parseHostnameList("name,site\nPC-A,London\n# skip\nPC-B,Paris\nPC-A,London\n");
  assert.deepEqual(parsed.hostnames, ["PC-A", "PC-B"]);
  assert.equal(parsed.duplicateCount, 1);
  assert.match(parsed.note ?? "", /name/i);
});

test("three thousand names match quickly and page-sized logic is not required to be complete", () => {
  const demo = buildLargeDemo(3000, NOW);
  const hostnames = parseHostnameList(demo.hostnameText).hostnames;
  const built = devicesFromCsv(demo.csv, "mdy");
  const started = Date.now();
  const { summary } = matchHostnames({
    hostnames,
    devices: built.devices,
    windowDays: 30,
    checkedAt: NOW,
    hasOsColumn: true,
  });
  const elapsed = Date.now() - started;
  assert.equal(hostnames.length, 3000);
  assert.equal(summary.lookedUp, 3000);
  assert.equal(summary.active + summary.inactive, 3000);
  assert.ok(summary.active > 0);
  assert.ok(summary.inactive > summary.active);
  assert.ok(elapsed < 1500, `matching took ${elapsed}ms`);
});

test("results CSV keeps status, check-in, compliance, and user", () => {
  const demo = buildDemo(NOW);
  const built = devicesFromCsv(demo.csv, "mdy");
  const { results } = matchHostnames({
    hostnames: ["pc-finance-01"],
    devices: built.devices,
    windowDays: 30,
    checkedAt: NOW,
    hasOsColumn: true,
  });
  const csv = resultsToCsv(results);
  assert.match(csv, /Hostname,Status,Device name,Last check-in/);
  assert.match(csv, /pc-finance-01,Active,PC-FINANCE-01/);
  assert.match(csv, /avery\.chen@contoso\.example/);
  assert.match(csv, /Compliant/);
});

test("header aliases and windows detection", () => {
  const columns = selectColumns([
    "HostName",
    "LastContact",
    "Compliance",
    "Primary User Email Address",
    "Platform",
  ]);
  assert.equal(columns.deviceName?.index, 0);
  assert.equal(columns.lastCheckIn?.index, 1);
  assert.equal(columns.primaryUser?.header, "Primary User Email Address");
  assert.equal(isWindowsOs("Windows 10"), true);
  assert.equal(isWindowsOs(""), true);
  assert.equal(isWindowsOs("Android"), false);
  assert.equal(parseWindowDays("30"), 30);
  assert.equal(parseWindowDays("0"), null);
  assert.equal(parseCheckIn("never", "mdy"), null);
  assert.equal(parseCheckIn("", "mdy"), null);
});

test("quoted newlines and utf-16 decode", () => {
  const parsed = parseCsv('Device name,Notes\n"PC-1","line\nstill one cell"\n');
  assert.equal(parsed.rows[0][0], "PC-1");
  assert.match(parsed.rows[0][1], /line\nstill/);

  const encoded = new Uint8Array(Buffer.from("\uFEFFDevice name\nPC-1\n", "utf16le"));
  const text = decodeSpreadsheetText(encoded);
  assert.match(text, /Device name/);
  assert.match(text, /PC-1/);
});

function stamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
