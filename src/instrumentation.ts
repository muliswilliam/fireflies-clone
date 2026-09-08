/**
 * Runs once when the server starts (Next instrumentation hook). The Node.js half lives in
 * `instrumentation-node.ts` so the Edge bundle never sees Node-only APIs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkServerEnvironment } = await import("./instrumentation-node");
    checkServerEnvironment();
  }
}
