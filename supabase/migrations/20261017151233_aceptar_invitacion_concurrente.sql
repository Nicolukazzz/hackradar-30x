-- Issue #51 (code review): dos invitaciones aceptadas a la vez por la misma cuenta pasaban las dos el chequeo
-- 'ya_miembro' y la segunda chocaba con la clave primaria (500). Ahora el INSERT no choca: si no insertó nada,
-- la cuenta ya era miembro y la invitación no se gasta.
create or replace function public.aceptar_invitacion(p_token_hash text, p_usuario uuid, p_correo text) returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  inv public.invitaciones;
  insertadas integer;
begin
  select * into inv from public.invitaciones where token_hash = p_token_hash for update;
  if not found or inv.revocada_en is not null or inv.expira_en <= now() or inv.usos >= inv.usos_max then
    return 'invalida';
  end if;
  if inv.correo_esperado is not null and inv.correo_esperado <> lower(btrim(coalesce(p_correo, ''))) then
    return 'otro_correo';
  end if;
  insert into public.membresias (empresa_id, usuario_id, rol, limite_aprobacion_usd, invitacion_id, agregada_por)
  values (inv.empresa_id, p_usuario, inv.rol, inv.limite_aprobacion_usd, inv.id, inv.creada_por)
  on conflict (empresa_id, usuario_id) do nothing;
  get diagnostics insertadas = row_count;
  if insertadas = 0 then
    return 'ya_miembro';
  end if;
  update public.invitaciones set usos = usos + 1 where id = inv.id;
  return 'aceptada';
end;
$$;

revoke all on function public.aceptar_invitacion(text, uuid, text) from public, anon, authenticated;
grant execute on function public.aceptar_invitacion(text, uuid, text) to service_role;
