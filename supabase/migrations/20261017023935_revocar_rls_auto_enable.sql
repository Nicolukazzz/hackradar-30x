-- rls_auto_enable() es la función del event trigger `ensure_rls` (activa RLS en tablas nuevas de public).
-- Nadie debe llamarla por la Data API; el event trigger no necesita EXECUTE de anon/authenticated.
-- Condicional: la función existe en el proyecto hospedado, no en un Supabase local (`supabase start`).
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
