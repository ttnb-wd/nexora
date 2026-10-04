import "server-only";
import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/env";

const runtime = globalThis as unknown as { nexoraAccountLockPool?: Pool };
function pool() {
  if (!runtime.nexoraAccountLockPool) {
    // Separate bounded lock connections prevent waiting callers from exhausting
    // the application pool that Better Auth needs to complete the mutation.
    runtime.nexoraAccountLockPool = new Pool({ connectionString: getDatabaseUrl(), max: 2, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
    runtime.nexoraAccountLockPool.on("error", () => { /* pg retires failed idle connections; never log credential-bearing diagnostics. */ });
  }
  return runtime.nexoraAccountLockPool;
}
export async function withAccountLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const client = await pool().connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["account-settings:" + userId]);
    return await work();
  } finally {
    try { await client.query("ROLLBACK"); } catch { discard = true; }
    client.release(discard);
  }
}
export async function disconnectAccountLocks() {
  const existing = runtime.nexoraAccountLockPool;
  runtime.nexoraAccountLockPool = undefined;
  await existing?.end();
}
