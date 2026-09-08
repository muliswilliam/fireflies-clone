import { getEnv } from "@/lib/env";

/**
 * Parses the environment at startup so a misconfigured deployment (say `AI_PROVIDER=claude`
 * without `ANTHROPIC_API_KEY`) stops with the variable named, instead of failing the first
 * Meeting a visitor tries to process. Next only logs an error thrown from `register` and keeps
 * a server that cannot work; exiting lets the process manager restart it once the environment is fixed.
 */
export function checkServerEnvironment(): void {
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
