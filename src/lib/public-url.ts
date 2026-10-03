/** Public links have their own origin; authentication continues to use APP_URL. */
export function resolvePublicAppUrl(publicUrl: string | undefined, appUrl: string, production = false) {
  const value = publicUrl?.trim() || appUrl;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Configure PUBLIC_APP_URL as a valid application origin."); }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || !["http:", "https:"].includes(url.protocol) || (production && Boolean(publicUrl?.trim()) && url.protocol !== "https:")) {
    throw new Error("PUBLIC_APP_URL must be an origin without credentials, path, query or fragment; use HTTPS in production.");
  }
  return url.origin;
}
export function isLoopbackUrl(value: string) {
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || /^127\./.test(hostname);
}
