import "server-only";
import { z } from "zod";

const authEnvironmentSchema = z.object({
  DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:\/\//.test(value)),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.url().refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash
      && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  }),
});
export function isAuthConfigured() {
  return authEnvironmentSchema.safeParse(process.env).success;
}
export function getDatabaseUrl() {
  const result = authEnvironmentSchema.shape.DATABASE_URL.safeParse(process.env.DATABASE_URL);
  if (!result.success) throw new Error("Configure a valid PostgreSQL DATABASE_URL before accessing the database.");
  return result.data;
}
export function getAuthEnvironment() {
  const result = authEnvironmentSchema.safeParse(process.env);
  if (!result.success) throw new Error("Configure DATABASE_URL, AUTH_SECRET, and APP_URL before enabling authentication.");
  return result.data;
}
