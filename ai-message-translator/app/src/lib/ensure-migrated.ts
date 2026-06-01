import { runMigrations } from "./migrate";

let migrationPromise: Promise<void> | null = null;

/** Run DB migrations once per process lifetime. Safe to call concurrently. */
export function ensureMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigrations();
  }
  return migrationPromise;
}
