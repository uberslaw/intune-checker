"use client";

import { useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResultsPanel } from "@/components/results-panel";
import { columnSummary } from "@/lib/columns";
import { CsvError } from "@/lib/csv";
import { parseWindowDays } from "@/lib/dates";
import { readSpreadsheetFile } from "@/lib/decode";
import { parseHostnameList } from "@/lib/hostnames";
import { devicesFromCsv, matchHostnames } from "@/lib/match";
import { buildDemo, buildLargeDemo, type DemoBundle } from "@/lib/sample";
import type { ColumnSelection, DateOrder, DeviceRow } from "@/lib/types";

type ExportState = {
  id: string;
  fileName: string;
  text: string;
  devices: DeviceRow[];
  columns: ColumnSelection;
  dataRows: number;
  headers: string[];
  dateOrder: DateOrder;
};

type Snapshot = {
  hostnames: string[];
  hostnameText: string;
  devices: DeviceRow[];
  hasOsColumn: boolean;
  hasCompliance: boolean;
  hasPrimaryUser: boolean;
  windowDays: number;
  checkedAt: Date;
  exportId: string;
  dateOrder: DateOrder;
  sourceLabel: string;
};

export function Checker() {
  const [hostnameText, setHostnameText] = useState("");
  const [windowInput, setWindowInput] = useState("30");
  const [dateOrder, setDateOrder] = useState<DateOrder>("mdy");
  const [exportState, setExportState] = useState<ExportState | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activity, setActivity] = useState<"reading" | "matching" | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const exportInputRef = useRef<HTMLInputElement>(null);
  const hostnameInputRef = useRef<HTMLInputElement>(null);

  const parsedList = useMemo(() => parseHostnameList(hostnameText), [hostnameText]);
  const windowDays = parseWindowDays(windowInput);
  const outcome = useMemo(
    () =>
      snapshot
        ? matchHostnames({
            hostnames: snapshot.hostnames,
            devices: snapshot.devices,
            windowDays: snapshot.windowDays,
            checkedAt: snapshot.checkedAt,
            hasOsColumn: snapshot.hasOsColumn,
          })
        : null,
    [snapshot],
  );

  const stale = Boolean(
    snapshot &&
      (snapshot.hostnameText !== hostnameText ||
        snapshot.exportId !== exportState?.id ||
        snapshot.dateOrder !== dateOrder),
  );

  async function loadBundle(bundle: DemoBundle) {
    const order = dateOrder;
    const days = windowDays ?? 30;
    if (windowDays == null) setWindowInput("30");
    setActivity("matching");
    setFormError(null);
    setExportError(null);
    await yieldToPaint();
    const built = devicesFromCsv(bundle.csv, order);
    const nextExport = toExportState(bundle.label, bundle.csv, built, order);
    setHostnameText(bundle.hostnameText);
    setExportState(nextExport);
    setSnapshot(
      makeSnapshot({
        hostnameText: bundle.hostnameText,
        hostnames: parseHostnameList(bundle.hostnameText).hostnames,
        exportState: nextExport,
        windowDays: days,
        dateOrder: order,
      }),
    );
    setActivity(null);
  }

  async function onExportFile(file: File) {
    setActivity("reading");
    setExportError(null);
    await yieldToPaint();
    try {
      const text = await readSpreadsheetFile(file);
      const built = devicesFromCsv(text, dateOrder);
      if (!built.columns.deviceName) {
        const found = built.headers.filter((header) => header.trim() !== "");
        setExportError(
          `No device name column. Found headers: ${found.join(", ") || "(none)"}. Expected a header like “Device name”.`,
        );
        return;
      }
      setExportState(toExportState(file.name, text, built, dateOrder));
    } catch (error) {
      setExportError(
        error instanceof CsvError
          ? error.message
          : "Couldn’t read this file as a CSV export.",
      );
    } finally {
      setActivity(null);
      if (exportInputRef.current) exportInputRef.current.value = "";
    }
  }

  async function onHostnameFile(file: File) {
    try {
      const text = await readSpreadsheetFile(file);
      setHostnameText(text);
      setFormError(null);
    } catch {
      setFormError("Couldn’t read that hostname file.");
    } finally {
      if (hostnameInputRef.current) hostnameInputRef.current.value = "";
    }
  }

  function changeWindow(value: string) {
    setWindowInput(value);
    const days = parseWindowDays(value);
    if (days == null) return;
    setSnapshot((current) => {
      if (!current || !exportState) return current;
      if (current.hostnameText !== hostnameText) return current;
      if (current.exportId !== exportState.id) return current;
      if (current.dateOrder !== dateOrder) return current;
      return { ...current, windowDays: days };
    });
  }

  function changeDateOrder(next: DateOrder) {
    setDateOrder(next);
    if (!exportState) return;
    const built = devicesFromCsv(exportState.text, next);
    const updated: ExportState = {
      ...exportState,
      devices: built.devices,
      columns: built.columns,
      dataRows: built.dataRows,
      headers: built.headers,
      dateOrder: next,
    };
    setExportState(updated);
    setSnapshot((current) => {
      if (!current || current.exportId !== exportState.id) return current;
      return {
        ...current,
        devices: updated.devices,
        dateOrder: next,
        hasOsColumn: Boolean(updated.columns.os),
        hasCompliance: Boolean(updated.columns.compliance),
        hasPrimaryUser: Boolean(updated.columns.primaryUser),
      };
    });
  }

  async function onCheck() {
    if (windowDays == null) {
      setFormError("The check-in window needs to be a whole number of days from 1 to 3,650.");
      return;
    }
    if (!exportState?.columns.deviceName) {
      setFormError("Upload an Intune Windows devices CSV, or load the demo.");
      return;
    }
    const hostnames = parsedList.hostnames;
    if (hostnames.length === 0) {
      setFormError("Add at least one hostname.");
      return;
    }
    setFormError(null);
    setActivity("matching");
    await yieldToPaint();
    setSnapshot(
      makeSnapshot({
        hostnameText,
        hostnames,
        exportState,
        windowDays,
        dateOrder,
      }),
    );
    setActivity(null);
  }

  function clearAll() {
    setHostnameText("");
    setWindowInput("30");
    setDateOrder("mdy");
    setExportState(null);
    setExportError(null);
    setFormError(null);
    setSnapshot(null);
    setActivity(null);
    setDragOver(false);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:px-6">
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
            Windows devices
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight">Intune Checker</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
                Look up a hostname list against an Intune Windows devices export
                and record which PCs are active. It uses the portal access you
                already have. No Global Admin, no app registration, and no new
                permission.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void loadBundle(buildDemo())}>
                Load demo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadBundle(buildLargeDemo(3000))}
              >
                Load 3,000-name demo
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 md:px-6">
        <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium">Active</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              A Windows row matches the hostname, ignoring capitalization and
              surrounding spaces, and its last check-in is within the window
              you set. The default is 30 days. A check-in exactly on the cutoff
              counts as active, including a timestamp dated in the future.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-medium">Inactive</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              No Windows row has that device name, or the last check-in is older
              than the window, or the last check-in is blank. A value that is
              not a date counts as missing. If the name appears more than once,
              the latest Windows check-in is kept.
            </p>
          </div>
        </section>

        <form
          className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
          onSubmit={(event) => {
            event.preventDefault();
            void onCheck();
          }}
        >
          <Card className="lg:row-span-2">
            <CardHeader>
              <CardTitle>1. Hostnames</CardTitle>
              <CardDescription>
                Paste one name per line, or a comma-separated list. A CSV with a
                Hostname or Device name column works too. Thousands of names stay
                in this tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Label htmlFor="hostnames">Hostname list</Label>
              <Textarea
                id="hostnames"
                value={hostnameText}
                onChange={(event) => setHostnameText(event.target.value)}
                placeholder={"PC-FINANCE-01\nLAPTOP-SALES-14"}
                spellCheck={false}
                className="min-h-56 overflow-auto font-mono text-[13px] leading-5 [field-sizing:fixed]"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {parsedList.hostnames.length === 0
                    ? "No hostnames yet."
                    : `${parsedList.hostnames.length.toLocaleString("en-US")} ${parsedList.hostnames.length === 1 ? "hostname" : "hostnames"}`}
                  {parsedList.duplicateCount > 0
                    ? ` · ${parsedList.duplicateCount.toLocaleString("en-US")} ${parsedList.duplicateCount === 1 ? "duplicate" : "duplicates"} removed`
                    : ""}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => hostnameInputRef.current?.click()}
                >
                  <Upload />
                  Upload list
                </Button>
                <input
                  ref={hostnameInputRef}
                  type="file"
                  accept=".txt,.csv,text/plain,text/csv"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onHostnameFile(file);
                  }}
                />
              </div>
              {parsedList.note ? (
                <p className="text-sm text-muted-foreground">{parsedList.note}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Check-in window</CardTitle>
              <CardDescription>
                Active means the matching Windows device checked in within this
                many days.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="window-days">Days</Label>
                <Input
                  id="window-days"
                  inputMode="numeric"
                  value={windowInput}
                  onChange={(event) => changeWindow(event.target.value)}
                  aria-invalid={windowInput.trim() !== "" && windowDays == null}
                  className="max-w-32"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {windowDays == null
                  ? "Enter a whole number from 1 to 3,650."
                  : `A check-in within the last ${windowDays} ${windowDays === 1 ? "day" : "days"} counts as active. The exact cutoff is set when you run the check.`}
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="date-order">Ambiguous numeric dates</Label>
                <select
                  id="date-order"
                  value={dateOrder}
                  onChange={(event) => changeDateOrder(event.target.value as DateOrder)}
                  className="h-8 max-w-xs rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="mdy">Month/day/year when both numbers are 12 or less</option>
                  <option value="dmy">Day/month/year when both numbers are 12 or less</option>
                </select>
                <p className="text-sm text-muted-foreground">
                  If one number is already greater than 12, that number is the day.
                  ISO dates and month names are read either way.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Intune export</CardTitle>
              <CardDescription>
                Intune admin center → Devices → Windows → Export. Upload that CSV.
                It is read locally and is not sent anywhere.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void onExportFile(file);
                }}
                className={`flex flex-col items-start gap-3 rounded-lg border border-dashed px-3 py-4 ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <p className="text-sm">
                  Drop the Windows devices CSV here, or choose the file.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportInputRef.current?.click()}
                >
                  <Upload />
                  Upload CSV
                </Button>
                <input
                  ref={exportInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onExportFile(file);
                  }}
                />
              </div>

              {exportError ? (
                <Alert variant="destructive">
                  <AlertTitle>The export could not be used</AlertTitle>
                  <AlertDescription>{exportError}</AlertDescription>
                </Alert>
              ) : null}

              {exportState?.columns.deviceName ? (
                <div className="text-sm leading-6">
                  <p className="font-medium">{exportState.fileName}</p>
                  <p className="text-muted-foreground">
                    {exportState.devices.length.toLocaleString("en-US")}{" "}
                    {exportState.devices.length === 1 ? "device" : "devices"} from{" "}
                    {exportState.dataRows.toLocaleString("en-US")}{" "}
                    {exportState.dataRows === 1 ? "row" : "rows"}.{" "}
                    {columnSummary(exportState.columns)}
                  </p>
                  {!exportState.columns.lastCheckIn ? (
                    <p className="mt-1 text-amber-800">
                      No last check-in column was found. Every match will be
                      inactive because the check-in is missing.
                    </p>
                  ) : null}
                  {!exportState.columns.os ? (
                    <p className="mt-1 text-muted-foreground">
                      No OS column, so every row is treated as a Windows device.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 lg:col-span-2">
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Check not started</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="lg" disabled={activity !== null}>
                {activity === "matching" ? "Matching…" : snapshot ? "Check again" : "Check devices"}
              </Button>
              <Button type="button" variant="ghost" onClick={clearAll}>
                Clear
              </Button>
            </div>
          </div>
        </form>

        <ResultsPanel
          activity={activity}
          pendingCount={parsedList.hostnames.length}
          outcome={outcome}
          hasCompliance={snapshot?.hasCompliance ?? false}
          hasPrimaryUser={snapshot?.hasPrimaryUser ?? false}
          sourceLabel={snapshot?.sourceLabel ?? ""}
          stale={stale}
        />
      </main>
    </div>
  );
}

function toExportState(
  fileName: string,
  text: string,
  built: {
    devices: DeviceRow[];
    columns: ColumnSelection;
    dataRows: number;
    headers: string[];
  },
  dateOrder: DateOrder,
): ExportState {
  return {
    id: crypto.randomUUID(),
    fileName,
    text,
    devices: built.devices,
    columns: built.columns,
    dataRows: built.dataRows,
    headers: built.headers,
    dateOrder,
  };
}

function makeSnapshot(input: {
  hostnameText: string;
  hostnames: string[];
  exportState: ExportState;
  windowDays: number;
  dateOrder: DateOrder;
}): Snapshot {
  return {
    hostnames: input.hostnames,
    hostnameText: input.hostnameText,
    devices: input.exportState.devices,
    hasOsColumn: Boolean(input.exportState.columns.os),
    hasCompliance: Boolean(input.exportState.columns.compliance),
    hasPrimaryUser: Boolean(input.exportState.columns.primaryUser),
    windowDays: input.windowDays,
    checkedAt: new Date(),
    exportId: input.exportState.id,
    dateOrder: input.dateOrder,
    sourceLabel: input.exportState.fileName,
  };
}

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}
