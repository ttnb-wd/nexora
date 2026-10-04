/** Explicit internal destinations only; never use an arbitrary client redirect. */
export function safeReturnPath(value: unknown) {
  if (typeof value !== "string") return "/dashboard";
  if (/^\/invitations\/[A-Za-z0-9_-]{43}$/.test(value)) return value;
  if (["/dashboard", "/dashboard/settings", "/dashboard/joined", "/dashboard/saved", "/dashboard/following", "/dashboard/notifications"].includes(value)) return value;
  return /^\/(?:events|companies)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 112 ? value : "/dashboard";
}
