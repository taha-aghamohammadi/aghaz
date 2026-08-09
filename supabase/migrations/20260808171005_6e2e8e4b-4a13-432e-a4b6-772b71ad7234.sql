REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;

CREATE POLICY "no client access to phone_otps" ON public.phone_otps
  FOR SELECT TO authenticated USING (false);