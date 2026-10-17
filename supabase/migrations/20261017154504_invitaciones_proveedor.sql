-- Issue #28: enlace con código único para que un proveedor que no está en la lista mande su factura. No crea
-- membresía (el proveedor nunca ve el panel): solo deja subir por /enviar/<token>, y todo lo que entra así se
-- escala (R11 nunca verifica un remitente `invitacion:*`). Nada de esto se escribe desde el cliente.

create table public.invitaciones_proveedor (
  id uuid primary key default gen_random_uuid(),
  -- sha256 (hex) del token del enlace: el token en claro solo lo ve quien crea la invitación.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  nombre_esperado text check (nombre_esperado is null or length(nombre_esperado) between 1 and 120),
  correo_esperado text check (correo_esperado is null or correo_esperado = lower(correo_esperado)),
  creada_por uuid references public.perfiles (id) on delete set null,
  creada_en timestamptz not null default now(),
  expira_en timestamptz not null,
  usos_max integer not null default 5 check (usos_max between 1 and 20),
  usos integer not null default 0 check (usos >= 0 and usos <= usos_max),
  revocada_en timestamptz,
  constraint invitaciones_proveedor_expira_despues check (expira_en > creada_en)
);

create index invitaciones_proveedor_creada on public.invitaciones_proveedor (creada_en desc);
create index invitaciones_proveedor_creada_por on public.invitaciones_proveedor (creada_por);

comment on table public.invitaciones_proveedor is 'Enlaces para que un proveedor nuevo envíe facturas (siempre escalan). Se guarda solo el hash del token.';

-- Usar el enlace es atómico: bloquea la invitación, valida (vigente, no revocada, con usos, correo esperado) y
-- cuenta el uso. Vencida, revocada y agotada devuelven lo mismo. Solo la llama el servidor con la llave secreta;
-- el correo sale de la sesión verificada, nunca del formulario.
create function public.usar_invitacion_proveedor(p_token_hash text, p_correo text)
  returns table (resultado text, invitacion_id uuid)
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  inv public.invitaciones_proveedor;
begin
  select * into inv from public.invitaciones_proveedor where token_hash = p_token_hash for update;
  if not found or inv.revocada_en is not null or inv.expira_en <= now() or inv.usos >= inv.usos_max then
    return query select 'invalida'::text, null::uuid;
    return;
  end if;
  if inv.correo_esperado is not null and inv.correo_esperado <> lower(btrim(coalesce(p_correo, ''))) then
    return query select 'otro_correo'::text, null::uuid;
    return;
  end if;
  update public.invitaciones_proveedor set usos = usos + 1 where id = inv.id;
  return query select 'ok'::text, inv.id;
end;
$$;

revoke all on function public.usar_invitacion_proveedor(text, text) from public, anon, authenticated;
grant execute on function public.usar_invitacion_proveedor(text, text) to service_role;

alter table public.invitaciones_proveedor enable row level security;
revoke all on table public.invitaciones_proveedor from anon, authenticated;
grant all on table public.invitaciones_proveedor to service_role;
