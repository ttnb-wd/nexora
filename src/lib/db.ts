import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "./env";

const databaseGlobal = globalThis as unknown as { nexoraPrisma?: PrismaClient };
let productionClient: PrismaClient | undefined;
/** Lazy initialization keeps public mock routes/builds independent of DB availability. */
export function getDb(): PrismaClient {
  const existing = process.env.NODE_ENV === "production" ? productionClient : databaseGlobal.nexoraPrisma;
  if (existing) return existing;
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl(), max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  // Disable query logging: auth queries may contain sensitive credential fields.
  const client = new PrismaClient({ adapter, log: [] });
  if (process.env.NODE_ENV === "production") productionClient = client;
  else databaseGlobal.nexoraPrisma = client;
  return client;
}
