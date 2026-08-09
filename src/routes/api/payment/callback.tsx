import { createFileRoute } from "@tanstack/react-router";
import { processPaymentCallback } from "@/lib/payment.server";

export const Route = createFileRoute("/api/payment/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const authority = url.searchParams.get("Authority") ?? undefined;
        const status = url.searchParams.get("Status") ?? undefined;
        const site = process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? "http://localhost:8080";
        const base = site.replace(/\/$/, "");

        try {
          const result = await processPaymentCallback({ authority, status });
          const dest = result.ok
            ? `${base}/account?paid=1`
            : `${base}/account?paid=0`;
          return new Response(null, {
            status: 302,
            headers: { Location: dest },
          });
        } catch {
          return new Response(null, {
            status: 302,
            headers: { Location: `${base}/account?paid=0` },
          });
        }
      },
    },
  },
  component: () => null,
});
