-- Issue #51: roles por empresa. Una cuenta (perfiles) entra al panel solo si tiene una membresía en la empresa;
-- el rol de la membresía decide qué puede hacer (admin · aprobador · tesoreria). Hoy hay una sola empresa
-- (Nébula), pero el acceso ya es por empresa. Las membresías nacen de invitaciones (enlace con token de un solo
-- uso que crea un admin) o del script del primer admin. Nada de esto se escribe desde el cliente.

create table public.empresas (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  nombre text not null check (length(nombre) between 1 and 120),
  creada_en timestamptz not null default now()
);

insert into public.empresas (id, nombre) values ('nebula', 'Nébula Studio Inc.') on conflict (id) do nothing;

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas (id) on delete cascade,
  -- sha256 (hex) del token del enlace: el token en claro solo lo ve quien crea la invitación.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  rol text not null check (rol in ('admin', 'aprobador', 'tesoreria')),
  limite_aprobacion_usd bigint check (limite_aprobacion_usd is null or limite_aprobacion_usd > 0),
  correo_esperado text check (correo_esperado is null or correo_esperado = lower(correo_esperado)),
  creada_por uuid references public.perfiles (id) on delete set null,
  creada_en timestamptz not null default now(),
  expira_en timestamptz not null,
  usos_max integer not null default 1 check (usos_max between 1 and 50),
  usos integer not null default 0 check (usos >= 0 and usos <= usos_max),
  revocada_en timestamptz,
  constraint invitaciones_limite_solo_aprobador check (rol = 'aprobador' or limite_aprobacion_usd is null),
  constraint invitaciones_expira_despues check (expira_en > creada_en)
);

create index invitaciones_empresa on public.invitaciones (empresa_id, creada_en desc);
create index invitaciones_creada_por on public.invitaciones (creada_por);

create table public.membresias (
  empresa_id text not null references public.empresas (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  rol text not null check (rol in ('admin', 'aprobador', 'tesoreria')),
  -- centavos USD; null = sin límite. Solo los aprobadores tienen límite (el admin aprueba cualquier monto).
  limite_aprobacion_usd bigint check (limite_aprobacion_usd is null or limite_aprobacion_usd > 0),
  invitacion_id uuid references public.invitaciones (id) on delete set null,
  agregada_por uuid references public.perfiles (id) on delete set null,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  primary key (empresa_id, usuario_id),
  constraint membresias_limite_solo_aprobador check (rol = 'aprobador' or limite_aprobacion_usd is null)
);

create index membresias_usuario on public.membresias (usuario_id);
create index membresias_invitacion on public.membresias (invitacion_id);
create index membresias_agregada_por on public.membresias (agregada_por);

comment on table public.empresas is 'Empresas que usan el agente. Hoy una sola (nebula).';
comment on table public.membresias is 'Quién pertenece a qué empresa y con qué rol. Solo la escribe el servidor.';
comment on table public.invitaciones is 'Enlaces para unirse a una empresa con un rol. Se guarda solo el hash del token.';

-- Una empresa nunca se queda sin admin (nadie podría invitar ni cambiar roles). El bloqueo de la fila de la
-- empresa serializa dos cambios simultáneos (dos admins quitándose el rol a la vez). Borrar la cuenta entera
-- (auth.users → perfiles en cascada) sí se permite: es una acción del equipo desde Supabase, no del panel.
create function private.proteger_ultimo_admin() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if old.rol <> 'admin' or (tg_op = 'UPDATE' and new.rol = 'admin') then
    return coalesce(new, old);
  end if;
  perform 1 from public.empresas e where e.id = old.empresa_id for update;
  if not found then
    return coalesce(new, old); -- se está borrando la empresa
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.perfiles p where p.id = old.usuario_id) then
    return old; -- se está borrando la cuenta
  end if;
  if not exists (
    select 1 from public.membresias m
    where m.empresa_id = old.empresa_id and m.rol = 'admin' and m.usuario_id <> old.usuario_id
  ) then
    raise exception 'La empresa debe tener al menos un administrador.' using errcode = 'P0001', hint = 'ultimo_admin';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.proteger_ultimo_admin() from public, anon, authenticated;

create trigger membresias_proteger_ultimo_admin
  before update or delete on public.membresias
  for each row execute function private.proteger_ultimo_admin();

-- Aceptar una invitación es atómico: bloquea la invitación, valida (vigente, no revocada, con usos, correo
-- esperado), crea la membresía y cuenta el uso. Devuelve un código, nunca el motivo exacto de una inválida
-- (vencida, revocada y agotada se ven igual). Solo la llama el servidor con la llave secreta; el correo
-- sale de la sesión verificada, nunca del formulario.
create function public.aceptar_invitacion(p_token_hash text, p_usuario uuid, p_correo text) returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  inv public.invitaciones;
begin
  select * into inv from public.invitaciones where token_hash = p_token_hash for update;
  if not found or inv.revocada_en is not null or inv.expira_en <= now() or inv.usos >= inv.usos_max then
    return 'invalida';
  end if;
  if inv.correo_esperado is not null and inv.correo_esperado <> lower(btrim(coalesce(p_correo, ''))) then
    return 'otro_correo';
  end if;
  if exists (select 1 from public.membresias m where m.empresa_id = inv.empresa_id and m.usuario_id = p_usuario) then
    return 'ya_miembro';
  end if;
  insert into public.membresias (empresa_id, usuario_id, rol, limite_aprobacion_usd, invitacion_id, agregada_por)
  values (inv.empresa_id, p_usuario, inv.rol, inv.limite_aprobacion_usd, inv.id, inv.creada_por);
  update public.invitaciones set usos = usos + 1 where id = inv.id;
  return 'aceptada';
end;
$$;

-- Miembros con nombre y correo (auth.users no está expuesto a la Data API). Solo servidor.
create function public.miembros_empresa(p_empresa text)
  returns table (usuario_id uuid, nombre text, correo text, rol text, limite_aprobacion_usd bigint, activo boolean, creada_en timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select m.usuario_id, p.nombre, u.email::text, m.rol, m.limite_aprobacion_usd, p.activo, m.creada_en
  from public.membresias m
  join public.perfiles p on p.id = m.usuario_id
  join auth.users u on u.id = m.usuario_id
  where m.empresa_id = p_empresa
  order by m.creada_en, m.usuario_id;
$$;

revoke all on function public.aceptar_invitacion(text, uuid, text) from public, anon, authenticated;
revoke all on function public.miembros_empresa(text) from public, anon, authenticated;
grant execute on function public.aceptar_invitacion(text, uuid, text) to service_role;
grant execute on function public.miembros_empresa(text) to service_role;

alter table public.empresas enable row level security;
alter table public.membresias enable row level security;
alter table public.invitaciones enable row level security;

revoke all on table public.empresas, public.membresias, public.invitaciones from anon, authenticated;
grant all on table public.empresas, public.membresias, public.invitaciones to service_role;
-- La sesión (obtenerSesion) lee la membresía propia con el cliente del usuario, igual que su perfil.
grant select on table public.membresias to authenticated;

create policy "membresias: leer la propia"
  on public.membresias
  for select
  to authenticated
  using ((select auth.uid()) = usuario_id);
