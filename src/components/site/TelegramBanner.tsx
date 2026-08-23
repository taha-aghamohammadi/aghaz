import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function TelegramBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("dismissedTelegramBanner") === "1") return;
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!data.user) return;
        return supabase.from("profiles").select("telegram_id").eq("id", data.user.id).maybeSingle();
      })
      .then((res) => {
        if (!res) return;
        if (!(res.data as { telegram_id?: number | null } | null)?.telegram_id) setShow(true);
      });
  }, []);
  if (!show) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <span>
        برای دریافت کد ورود و اعلان‌ها در تلگرام —{" "}
        <Link to="/account" className="text-primary underline">
          اتصال در حساب کاربری
        </Link>
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          localStorage.setItem("dismissedTelegramBanner", "1");
          setShow(false);
        }}
        className="h-7 rounded-full"
      >
        بستن
      </Button>
    </div>
  );
}
