/** Client-side OTP demo flag — mirrors `OTP_DEMO_MODE` on the server. */
export function isOtpDemoMode(): boolean {
  return import.meta.env.VITE_OTP_DEMO_MODE === "true";
}
