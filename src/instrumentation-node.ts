import { getEnv } from "@/lib/env";

/**
 * Parses the environment at startup so a bad deployment stops with the variable named.
 * Next only logs a throw from `register` and keeps serving, hence the exit.
 */
export function checkServerEnvironment(): void {
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
