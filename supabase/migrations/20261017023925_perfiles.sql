-- Issue #25: rol de cada usuario de Supabase Auth. El rol nunca sale de user_metadata (lo edita el
-- propio usuario): se lee de esta tabla en el servidor en cada acción sensible.

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol text not null check (rol in ('tesoreria', 'aprobador', 'proveedor')),
  aprobador_id text,     -- id de data/aprobadores.json (solo rol aprobador)
  beneficiario_id text,  -- id de data/proveedores.json (solo rol proveedor)
  nombre text not null check (length(nombre) between 1 and 120),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint perfiles_aprobador_solo_si_rol check ((rol = 'aprobador') = (aprobador_id is not null)),
  constraint perfiles_beneficiario_solo_si_rol check ((rol = 'proveedor') = (beneficiario_id is not null))
);

comment on table public.perfiles is 'Rol y vínculo (aprobador o beneficiario) de cada usuario. Solo lo escribe el servidor con la llave secreta.';

alter table public.perfiles enable row level security;

-- Las tablas nuevas ya no se exponen solas a la Data API (changelog 2026-04-28): permisos explícitos.
revoke all on table public.perfiles from anon, authenticated;
grant select on table public.perfiles to authenticated;
grant all on table public.perfiles to service_role;

-- Cada usuario solo lee su propia fila. No hay políticas de insert/update/delete: desde el cliente
-- nadie escribe; la semilla y tesorería usan la llave secreta (service_role, salta RLS).
create policy "perfiles: leer el propio"
  on public.perfiles
  for select
  to authenticated
  using ((select auth.uid()) = id);
