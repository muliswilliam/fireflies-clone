/** Next instrumentation hook. Node-only code lives in `instrumentation-node.ts`, away from the Edge bundle. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkServerEnvironment } = await import("./instrumentation-node");
    checkServerEnvironment();
  }
}
