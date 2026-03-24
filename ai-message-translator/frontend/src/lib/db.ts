import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Lazily initialized SQL client. Deferred to first use so that builds
// succeed even when DATABASE_URL is not set at compile time.
let _sql: NeonQueryFunction<false, false> | null = null;

export function getSQL(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  _sql = neon(databaseUrl);
  return _sql;
}
