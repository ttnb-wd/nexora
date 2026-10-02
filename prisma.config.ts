import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // No fabricated URL: offline validate/generate/diff work without a connection.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
