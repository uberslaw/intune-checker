import type { DateOrder } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const MISSING =
  /^(?:n\/a|na|null|none|never|undefined|not available|unknown|-|—|–|\.)$/i;

export function dayMs(): number {
  return DAY_MS;
}

export function parseWindowDays(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const days = Number(trimmed);
  if (days < 1 || days > 3650) return null;
  return days;
}

export function cutoffFrom(checkedAt: Date, windowDays: number): Date {
  return new Date(checkedAt.getTime() - windowDays * DAY_MS);
}

export function daysSince(checkedAt: Date, checkIn: Date): number {
  return Math.floor((checkedAt.getTime() - checkIn.getTime()) / DAY_MS);
}

export function parseCheckIn(raw: string, order: DateOrder = "mdy"): Date | null {
  const value = raw.trim();
  if (!value || MISSING.test(value)) return null;

  const iso =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  const isoMatch = value.match(iso);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const hour = Number(isoMatch[4] ?? "0");
    const minute = Number(isoMatch[5] ?? "0");
    const second = Number(isoMatch[6] ?? "0");
    const zone = isoMatch[7];
    if (zone) {
      const normalized = value.includes("T") ? value : value.replace(" ", "T");
      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return validLocalDate(year, month, day, hour, minute, second);
  }

  const withoutMeridiem = value.replace(/\b(?:AM|PM)\b/gi, "");
  if (/[a-z]/i.test(withoutMeridiem)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const numeric =
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i;
  const match = value.match(numeric);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;

  let month: number;
  let day: number;
  if (first > 12 && second <= 12) {
    day = first;
    month = second;
  } else if (second > 12 && first <= 12) {
    month = first;
    day = second;
  } else if (order === "dmy") {
    day = first;
    month = second;
  } else {
    month = first;
    day = second;
  }

  let hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;
  const secondPart = match[6] ? Number(match[6]) : 0;
  const ampm = match[7]?.toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return validLocalDate(year, month, day, hour, minute, secondPart);
}

function validLocalDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date | null {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatStampForCsv(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatUsDateTime(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

export function shiftDays(from: Date, days: number): Date {
  return new Date(from.getTime() - days * DAY_MS);
}
