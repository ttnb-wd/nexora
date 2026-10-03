import "server-only";
import { getAuthEnvironment } from "./env";
import { isLoopbackUrl, resolvePublicAppUrl } from "./public-url";
export function getPublicAppUrl(externalQr = false) {
  const url = resolvePublicAppUrl(process.env.PUBLIC_APP_URL, getAuthEnvironment().APP_URL, process.env.NODE_ENV === "production");
  if (externalQr && process.env.NODE_ENV === "development" && isLoopbackUrl(url)) {
    console.warn("[Nexora] Ticket QR uses localhost. For phone testing, set PUBLIC_APP_URL to your PC's LAN origin and restart the dev server.");
  }
  return url;
}
