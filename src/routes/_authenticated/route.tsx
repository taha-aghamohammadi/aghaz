import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TermsGate } from "@/components/site/TermsGate";
import { TelegramBanner } from "@/components/site/TelegramBanner";
import { ProfileCompletionGate } from "@/components/site/ProfileCompletionGate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <ProfileCompletionGate>
      <TermsGate>
        <TelegramBanner />
        <Outlet />
      </TermsGate>
    </ProfileCompletionGate>
  ),
});
