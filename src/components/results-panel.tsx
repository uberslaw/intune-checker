"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTimestamp } from "@/lib/dates";
import { resultsFilename, resultsToCsv } from "@/lib/results-csv";
import type { CheckResult, CheckStatus, MatchSummary } from "@/lib/types";

const PAGE_SIZE = 50;

type Filter = "all" | CheckStatus;

export function ResultsPanel({
  activity,
  pendingCount,
  outcome,
  hasCompliance,
  hasPrimaryUser,
  sourceLabel,
  stale,
}: {
  activity: "reading" | "matching" | null;
  pendingCount: number;
  outcome: { results: CheckResult[]; summary: MatchSummary } | null;
  hasCompliance: boolean;
  hasPrimaryUser: boolean;
  sourceLabel: string;
  stale: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    if (!outcome) return [];
    const needle = query.trim().toLowerCase();
    return outcome.results.filter((result) => {
      if (filter !== "all" && result.status !== filter) return false;
      if (!needle) return true;
      return [
        result.hostname,
        result.deviceName,
        result.primaryUser,
        result.compliance,
        result.reason,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [outcome, filter, query]);

  const pageCount = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = view.slice(start, start + PAGE_SIZE);

  if (!outcome && activity) {
    return (
      <Card>
        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
          <p role="status" className="text-base font-medium">
            {activity === "reading"
              ? "Reading the export…"
              : `Matching ${pendingCount.toLocaleString("en-US")} hostnames…`}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            This stays in your browser. Nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!outcome) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            No check yet. Add hostnames and a Windows devices export, then run
            the check. Load the demo if you want a worked example first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
            <li className="rounded-lg bg-muted px-3 py-3">
              Active PCs show a check-in inside the window.
            </li>
            <li className="rounded-lg bg-muted px-3 py-3">
              Inactive covers missing devices, old check-ins, and blank dates.
            </li>
            <li className="rounded-lg bg-muted px-3 py-3">
              Download the full table as CSV when you are done.
            </li>
          </ul>
        </CardContent>
      </Card>
    );
  }

  const { summary } = outcome;
  const breakdown = inactiveBreakdown(summary);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>
          {summary.lookedUp.toLocaleString("en-US")} hostnames against {sourceLabel}.{" "}
          Checked at {formatTimestamp(summary.checkedAt)}. Active means a check-in
          on or after {formatTimestamp(summary.cutoff)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activity ? (
          <p role="status" className="text-sm font-medium">
            {activity === "reading"
              ? "Reading the export…"
              : `Matching ${pendingCount.toLocaleString("en-US")} hostnames…`}
          </p>
        ) : null}
        {stale ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            The hostname list or export has changed. Run the check again to
            refresh these results.
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Looked up" value={summary.lookedUp} />
          <Stat label="Active" value={summary.active} tone="active" />
          <Stat label="Inactive" value={summary.inactive} tone="inactive" />
        </div>
        {breakdown ? (
          <p className="text-sm text-muted-foreground">{breakdown}</p>
        ) : null}
        {summary.duplicateDeviceNames > 0 ? (
          <p className="text-sm text-muted-foreground">
            {summary.duplicateDeviceNames.toLocaleString("en-US")} device{" "}
            {summary.duplicateDeviceNames === 1 ? "name appears" : "names appear"}{" "}
            more than once. The latest check-in was kept.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs
            value={filter}
            onValueChange={(value) => {
              setFilter(value as Filter);
              setPage(0);
            }}
          >
            <TabsList className="w-full md:w-fit">
              <TabsTrigger value="all">
                All {summary.lookedUp.toLocaleString("en-US")}
              </TabsTrigger>
              <TabsTrigger value="active">
                Active {summary.active.toLocaleString("en-US")}
              </TabsTrigger>
              <TabsTrigger value="inactive">
                Inactive {summary.inactive.toLocaleString("en-US")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Filter by hostname, user, or device"
              aria-label="Filter results"
              className="sm:w-72"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadResults(outcome.results, summary.checkedAt)}
            >
              <Download />
              Download CSV
            </Button>
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Device name</TableHead>
                <TableHead>Last check-in</TableHead>
                {hasCompliance ? <TableHead>Compliance</TableHead> : null}
                {hasPrimaryUser ? <TableHead>Primary user</TableHead> : null}
                <TableHead>Why</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5 + Number(hasCompliance) + Number(hasPrimaryUser)}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No hostnames match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((result) => (
                  <TableRow key={result.hostname}>
                    <TableCell className="font-medium">{result.hostname}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          result.status === "active"
                            ? "border-transparent bg-emerald-800 text-white"
                            : "border-transparent bg-amber-800 text-white"
                        }
                      >
                        {result.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{result.deviceName || "—"}</TableCell>
                    <TableCell>
                      {result.lastCheckIn ? (
                        <span className="block">
                          {formatTimestamp(result.lastCheckIn)}
                          <span className="block text-xs text-muted-foreground">
                            {ageLabel(result.daysSinceCheckIn)}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {hasCompliance ? (
                      <TableCell>{result.compliance || "—"}</TableCell>
                    ) : null}
                    {hasPrimaryUser ? (
                      <TableCell>{result.primaryUser || "—"}</TableCell>
                    ) : null}
                    <TableCell className="max-w-xs whitespace-normal text-muted-foreground">
                      {result.reason}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            {view.length === 0
              ? "0 rows"
              : `${(start + 1).toLocaleString("en-US")}–${Math.min(start + PAGE_SIZE, view.length).toLocaleString("en-US")} of ${view.length.toLocaleString("en-US")}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              Previous
            </Button>
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "active" | "inactive";
}) {
  const toneClass =
    tone === "active"
      ? "text-emerald-800"
      : tone === "inactive"
        ? "text-amber-800"
        : "text-foreground";
  return (
    <div className="rounded-lg bg-muted px-3 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

function ageLabel(days: number | null): string {
  if (days === null) return "No check-in";
  if (days < 0) return "In the future";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days.toLocaleString("en-US")} days ago`;
}

function inactiveBreakdown(summary: MatchSummary): string {
  const parts: string[] = [];
  const { reasons } = summary;
  if (reasons["no-match"] > 0) {
    parts.push(`${reasons["no-match"].toLocaleString("en-US")} not in the export`);
  }
  if (reasons["outside-window"] > 0) {
    parts.push(
      `${reasons["outside-window"].toLocaleString("en-US")} outside the window`,
    );
  }
  if (reasons["missing-checkin"] > 0) {
    parts.push(
      `${reasons["missing-checkin"].toLocaleString("en-US")} missing check-in`,
    );
  }
  if (reasons["unreadable-checkin"] > 0) {
    parts.push(
      `${reasons["unreadable-checkin"].toLocaleString("en-US")} unreadable check-in`,
    );
  }
  if (parts.length === 0) return "";
  return `Inactive: ${parts.join(" · ")}.`;
}

function downloadResults(results: CheckResult[], checkedAt: Date) {
  const blob = new Blob([resultsToCsv(results)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = resultsFilename(checkedAt);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
