export function formatEventDate(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString("en", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }); }
