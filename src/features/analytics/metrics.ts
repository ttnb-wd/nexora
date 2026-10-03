export const analyticsRanges = ["30", "90", "all"] as const;
export type AnalyticsRange = typeof analyticsRanges[number];
export function analyticsRange(value: unknown): AnalyticsRange { return value === "30" || value === "90" ? value : "all"; }
export function rangeStart(range: AnalyticsRange, now: Date) { return range === "all" ? null : new Date(now.getTime() - Number(range) * 86400000); }
export type StatusCounts = { REGISTERED: number; ATTENDED: number; CANCELLED: number; WAITLISTED: number; NO_SHOW: number };
export function statusCounts(groups: { status: keyof StatusCounts; _count: { _all: number } }[]): StatusCounts {
  const counts = { REGISTERED: 0, ATTENDED: 0, CANCELLED: 0, WAITLISTED: 0, NO_SHOW: 0 };
  for (const group of groups) counts[group.status] = group._count._all;
  return counts;
}
export function eventMetrics(counts: StatusCounts, capacity: number | null) {
  const occupied = counts.REGISTERED + counts.ATTENDED;
  return { counts, totalRegistrations: Object.values(counts).reduce((a,b) => a+b,0), occupied,
    attendanceRate: occupied ? counts.ATTENDED / occupied * 100 : null,
    capacity, remaining: capacity === null ? null : Math.max(0,capacity-occupied),
    utilization: capacity === null || capacity <= 0 ? null : occupied / capacity * 100 };
}
export function percent(value: number | null) { return value === null ? "Not available" : `${Number(value.toFixed(1))}%`; }
