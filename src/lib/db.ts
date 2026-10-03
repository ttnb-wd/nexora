import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "./env";

type DatabaseRuntime = { pool: Pool; adapter: PrismaPg; client: PrismaClient };
const databaseGlobal = globalThis as unknown as { nexoraDatabaseRuntime?: DatabaseRuntime };
/** Lazy initialization avoids opening database connections during module loading. */
export function getDb(): PrismaClient {
  if (databaseGlobal.nexoraDatabaseRuntime) return databaseGlobal.nexoraDatabaseRuntime.client;
  const pool = new Pool({
    connectionString: getDatabaseUrl(), // Runtime always uses DATABASE_URL, never DIRECT_URL.
    max: 5, // Bound per-process connections and relation-query fan-out behind Neon's pooler.
    connectionTimeoutMillis: 15_000, // Bounded wait for connection/checkout, including Neon wake-up + TLS.
    idleTimeoutMillis: 30_000, // Release unused sockets; do not keep the compute awake indefinitely.
    keepAlive: true, // TCP probes help detect broken connections on long-lived Node processes.
  });
  // pg discards failed idle connections itself. Keep their diagnostics server-side
  // without logging the Pool/configuration, which contains database credentials.
  pool.on("error", (error: Error) => console.error("Runtime database idle connection failed", { name: error.name, message: error.message }));
  // Explicit shutdown ($disconnect in a CLI/test) also disposes the owned pool.
  // Ordinary request handlers must never disconnect this process-wide stack.
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });
  // Disable query logging: auth queries may contain sensitive credential fields.
  // Better Auth uses the client's default interactive transaction window. Five
  // seconds is too short for a valid remote Neon transaction during a slow wake-up.
  const client = new PrismaClient({ adapter, log: [], transactionOptions: { maxWait: 10000, timeout: 15000 } });
  // Store all ownership together, in every Node environment. Module reloads must
  // not create a second adapter/pool alongside a surviving PrismaClient.
  databaseGlobal.nexoraDatabaseRuntime = { pool, adapter, client };
  return client;
}
