export type DateOrder = "mdy" | "dmy";

export type HeaderHit = {
  index: number;
  header: string;
};

export type ColumnSelection = {
  deviceName: HeaderHit | null;
  lastCheckIn: HeaderHit | null;
  compliance: HeaderHit | null;
  primaryUser: HeaderHit | null;
  os: HeaderHit | null;
};

export type DeviceRow = {
  deviceName: string;
  lastCheckInRaw: string;
  lastCheckIn: Date | null;
  compliance: string;
  primaryUser: string;
  os: string;
};

export type ReasonCode =
  | "within-window"
  | "future-checkin"
  | "no-match"
  | "outside-window"
  | "missing-checkin"
  | "unreadable-checkin";

export type CheckStatus = "active" | "inactive";

export type CheckResult = {
  hostname: string;
  status: CheckStatus;
  reasonCode: ReasonCode;
  reason: string;
  deviceName: string;
  lastCheckInRaw: string;
  lastCheckIn: Date | null;
  daysSinceCheckIn: number | null;
  compliance: string;
  primaryUser: string;
  os: string;
};

export type ReasonCounts = Record<ReasonCode, number>;

export type MatchSummary = {
  lookedUp: number;
  active: number;
  inactive: number;
  windowDays: number;
  checkedAt: Date;
  cutoff: Date;
  duplicateDeviceNames: number;
  reasons: ReasonCounts;
};
