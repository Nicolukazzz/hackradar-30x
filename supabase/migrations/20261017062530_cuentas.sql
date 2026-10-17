-- Issue #49: login abierto. Cualquiera crea su cuenta (correo + contraseña); sin roles por ahora.
-- perfiles queda con lo que se muestra (nombre) y el interruptor `activo` para cortar el acceso.
-- rol / aprobador_id / beneficiario_id ya no se usan: quedan opcionales (sin borrar) para no romper el
-- deploy anterior mientras se publica este; se pueden eliminar en una migración posterior.

alter table public.perfiles drop constraint if exists perfiles_aprobador_solo_si_rol;
alter table public.perfiles drop constraint if exists perfiles_beneficiario_solo_si_rol;
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles alter column rol drop not null;
comment on column public.perfiles.rol is 'Sin uso desde #49 (no hay roles). Se elimina más adelante.';

comment on table public.perfiles is 'Nombre visible y estado de cada cuenta. Lo crea un trigger al registrarse; nadie lo escribe desde el cliente.';

-- Perfil automático al crear la cuenta. Schema no expuesto a la Data API: nadie puede llamarla por RPC.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.crear_perfil() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1), 'Usuario'), 120)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.crear_perfil() from public, anon, authenticated;

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function private.crear_perfil();

-- Cuentas que ya existían sin perfil (no debería haber, pero por si acaso).
insert into public.perfiles (id, nombre)
select u.id, left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nombre'), ''), split_part(u.email, '@', 1), 'Usuario'), 120)
from auth.users u
on conflict (id) do nothing;
