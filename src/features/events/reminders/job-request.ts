import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { ReminderRunResult } from "./scheduler";

export function authorizedReminderJob(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || secret.trim() !== secret || !header?.startsWith("Bearer ") || header.length > 4096) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}
export async function handleReminderJob(request: Request, secret: string | undefined, run: () => Promise<ReminderRunResult>, method: "POST" | "GET" = "POST") {
  const headers = { "Cache-Control": "no-store" };
  if (request.method !== method) return Response.json({ error: "Method not allowed" }, { status: 405, headers: { ...headers, Allow: method } });
  if (!secret || secret.length < 32 || secret.trim() !== secret) return Response.json({ error: "Scheduler unavailable" }, { status: 503, headers });
  if (!authorizedReminderJob(request.headers.get("authorization"), secret)) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  // No selectors, client clocks or batch overrides. Refuse targeting parameters.
  if (new URL(request.url).search) return Response.json({ error: "This job accepts no parameters" }, { status: 400, headers });
  // Next's Node adapter can expose a stream even for Content-Length: 0.
  // Inspect bytes, not stream presence; stop on the first nonempty chunk rather
  // than buffering an arbitrary authenticated payload into memory.
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (chunk.value.byteLength) return Response.json({ error: "This job accepts no parameters" }, { status: 400, headers });
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
  try {
    const result = await run();
    const summary = { processed: result.processed, delivered: result.delivered, skipped: result.skipped, failed: result.failed };
    console.info("Reminder scheduler", summary);
    return Response.json(summary, { status: summary.failed ? 503 : 200, headers });
  } catch {
    return Response.json({ error: "Scheduler unavailable" }, { status: 503, headers });
  }
}

/** Only the server's cron adapter opts into GET; POST stays the default. */
export function handleReminderCron(request: Request, secret: string | undefined, run: () => Promise<ReminderRunResult>) {
  return handleReminderJob(request, secret, run, "GET");
}
