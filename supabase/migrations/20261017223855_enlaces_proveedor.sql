-- Issue #85: enlace para que un proveedor vincule su correo de facturación (reemplaza invitaciones_proveedor de #28,
-- que queda sin uso). La empresa crea un enlace de un solo uso para un beneficiario de la lista o para un proveedor
-- nuevo; quien lo abre escribe su correo y recibe un id de conexión. No se envía ningún correo desde la app.

-- Correo de facturación vinculado a un beneficiario (base de data/proveedores.json o agregado). Un correo pertenece a
-- un solo beneficiario; un beneficiario puede tener varios. Como vinculos_telegram, no depende de la corrida de demo.
create table public.vinculos_correo (
  correo text primary key check (correo = lower(correo) and length(correo) between 3 and 254),
  beneficiario_id text not null check (length(beneficiario_id) between 1 and 80),
  creado_en timestamptz not null default now()
);

comment on table public.vinculos_correo is 'Correos de facturación de cada beneficiario agregados por enlace (R11).';

create table public.enlaces_proveedor (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- null = proveedor nuevo (fuera de la lista permitida)
  beneficiario_id text check (length(beneficiario_id) between 1 and 80),
  nombre text not null check (length(nombre) between 1 and 120),
  creado_por uuid,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  revocado_en timestamptz,
  usado_en timestamptz,
  correo text check (correo = lower(correo)),
  conexion_id text unique check (conexion_id ~ '^PRV-[0-9A-Z]{4}-[0-9A-Z]{4}$'),
  check ((usado_en is null) = (correo is null) and (usado_en is null) = (conexion_id is null))
);

comment on table public.enlaces_proveedor is 'Enlaces de un solo uso para que un proveedor vincule su correo; guarda el id de conexión resultante.';

-- Usar el enlace es atómico y con el reloj de la base: dos envíos a la vez no lo usan dos veces.
create function public.usar_enlace_proveedor(p_token_hash text, p_correo text, p_conexion text) returns uuid
  language sql
  security definer
  set search_path = ''
as $$
  update public.enlaces_proveedor
     set usado_en = now(), correo = lower(p_correo), conexion_id = p_conexion
   where token_hash = p_token_hash and usado_en is null and revocado_en is null and expira_en > now()
  returning id;
$$;

revoke all on function public.usar_enlace_proveedor(text, text, text) from public, anon, authenticated;
grant execute on function public.usar_enlace_proveedor(text, text, text) to service_role;

alter table public.vinculos_correo enable row level security;
alter table public.enlaces_proveedor enable row level security;
revoke all on table public.vinculos_correo, public.enlaces_proveedor from anon, authenticated;
grant all on table public.vinculos_correo, public.enlaces_proveedor to service_role;
