/** Explicit internal destinations only; never use an arbitrary client redirect. */
export function safeReturnPath(value: unknown) {
  if (typeof value !== "string") return "/dashboard";
  if (["/dashboard", "/dashboard/joined", "/dashboard/saved", "/dashboard/following", "/dashboard/notifications"].includes(value)) return value;
  return /^\/(?:events|companies)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 112 ? value : "/dashboard";
}
