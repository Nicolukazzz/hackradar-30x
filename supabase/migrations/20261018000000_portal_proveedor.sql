-- Issue #85 (segunda versión): portal del proveedor con correo + código. Reemplaza el enlace de un solo uso de
-- 20261017223855_enlaces_proveedor (solo tenía filas de prueba del mismo día). El admin crea un enlace para un
-- proveedor con su nombre, su correo y un código de 8 caracteres; el proveedor entra con ese correo y ese código y
-- sube sus facturas. La app no envía correos: el admin comparte el enlace y el código.

drop function if exists public.usar_enlace_proveedor(text, text, text);
drop table if exists public.enlaces_proveedor;
drop table if exists public.vinculos_correo;

create table public.enlaces_proveedor (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- sha256 del código normalizado; único: no hay dos proveedores con el mismo código
  codigo_hash text not null unique check (codigo_hash ~ '^[0-9a-f]{64}$'),
  nombre text not null check (length(nombre) between 2 and 120),
  correo text not null check (correo = lower(correo) and length(correo) between 3 and 254),
  -- beneficiario de la lista con ese correo al crear el enlace; null = proveedor nuevo
  beneficiario_id text check (length(beneficiario_id) between 1 and 80),
  creado_por uuid,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  revocado_en timestamptz,
  codigo_cambiado_en timestamptz,
  ultimo_acceso timestamptz
);

comment on table public.enlaces_proveedor is 'Portal del proveedor (#85): enlace + correo + código para subir facturas sin cuenta.';

alter table public.enlaces_proveedor enable row level security;
revoke all on table public.enlaces_proveedor from anon, authenticated;
grant all on table public.enlaces_proveedor to service_role;
