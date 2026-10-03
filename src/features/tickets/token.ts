import { createHash, createHmac, randomBytes } from "node:crypto";

// Domain separation prevents reuse of the auth key's output in another protocol.
export function tokenFromNonce(nonce: string, secret: string) {
  if (secret.length < 32 || !/^[a-f0-9]{64}$/.test(nonce)) throw new Error("Invalid ticket configuration.");
  return createHmac("sha256", secret).update(`nexora:event-ticket:v1:${nonce}`).digest("base64url");
}
export function newTicket(secret: string) {
  const ticketNonce = randomBytes(32).toString("hex");
  const token = tokenFromNonce(ticketNonce, secret);
  return { token, ticketNonce, ticketTokenHash: hashTicketToken(token), ticketIssuedAt: new Date() };
}
export function hashTicketToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function parseTicketToken(input: unknown, appUrl: string): string | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  let token = input.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    try {
      const url = new URL(token);
      // The credential stays in the fragment, out of HTTP logs and Referer headers.
      if (url.origin !== new URL(appUrl).origin || url.pathname !== "/check-in/ticket" || url.search) return null;
      token = url.hash.slice(1);
    } catch { return null; }
  }
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
export function ticketUrl(token: string, appUrl: string) {
  const url = new URL("/check-in/ticket", appUrl);
  url.hash = token;
  return url.href;
}
export function ticketEligible(event: { status: string; endAt: Date }, status: string, now = new Date()) {
  return event.status === "PUBLISHED" && event.endAt > now && status === "REGISTERED";
}
