/** Wall-clock inputs are interpreted only in the explicitly selected IANA timezone. */
export function isValidTimezone(timezone: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); return !!timezone; }
  catch { return false; }
}
function partsAt(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return [value("year"), value("month"), value("day"), value("hour"), value("minute"), value("second")];
}
function wallTimestamp(parts: number[]) { return Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5] ?? 0); }

export function zonedDateTimeToUtc(date: string, time: string, timezone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !isValidTimezone(timezone)) throw new Error("Enter a valid date, time, and timezone.");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (year < 2000 || year > 2100 || hour > 23 || minute > 59) throw new Error("Use a valid date between 2000 and 2100 and a valid time.");
  const wall = wallTimestamp([year, month, day, hour, minute]);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) throw new Error("Enter a valid calendar date.");
  // Collect nearby offsets, including both sides of daylight-saving transitions.
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = wall + hours * 3600000;
    offsets.add(wallTimestamp(partsAt(new Date(sample), timezone)) - sample);
  }
  const matches = [...offsets].map((offset) => new Date(wall - offset))
    .filter((candidate) => wallTimestamp(partsAt(candidate, timezone)) === wall);
  if (matches.length === 0) throw new Error("This local time does not exist because the clocks change. Choose another time.");
  if (matches.length > 1) throw new Error("This local time occurs twice because the clocks change. Choose an unambiguous time.");
  return matches[0];
}
export function utcToLocalInputs(date: Date, timezone: string) {
  const [year, month, day, hour, minute] = partsAt(date, timezone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return { date: `${year}-${pad(month)}-${pad(day)}`, time: `${pad(hour)}:${pad(minute)}` };
}
export function formatManagedEventDate(date: Date | string, timezone: string) {
  return new Intl.DateTimeFormat("en", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}
