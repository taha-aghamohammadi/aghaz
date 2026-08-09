/** Client-side error hook for error boundaries (no third-party telemetry). */
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[client-error]", error, context);
}
