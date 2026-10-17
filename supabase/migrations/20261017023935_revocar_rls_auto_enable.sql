-- rls_auto_enable() es la función del event trigger `ensure_rls` (activa RLS en tablas nuevas de public).
-- Nadie debe llamarla por la Data API; el event trigger no necesita EXECUTE de anon/authenticated.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
