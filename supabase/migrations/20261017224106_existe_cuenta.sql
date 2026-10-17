-- «¿Olvidaste tu contraseña?» solo manda el código si el correo es de una cuenta activa (auth.users no está
-- expuesto a la Data API). Solo servidor.
create function public.existe_cuenta_activa(p_correo text) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.perfiles p on p.id = u.id
    where lower(u.email) = lower(btrim(p_correo)) and p.activo
  );
$$;

revoke all on function public.existe_cuenta_activa(text) from public, anon, authenticated;
grant execute on function public.existe_cuenta_activa(text) to service_role;
