-- Issue #44: persistencia del repositorio (#17) para que la demo sobreviva a los deploys.
-- Solo el servidor (llave secreta, service_role) lee y escribe. Nada se expone al navegador.

-- Registro append-only (§9): una fila por EntradaRegistro, en orden de inserción.
create table public.registro (
  orden bigint generated always as identity primary key,
  id text not null unique,                 -- REG-2026-000001 / REG-HIST-0001
  ref_interna text not null,
  tipo text not null check (tipo in ('DECISION_AGENTE', 'DECISION_HUMANA', 'CAMBIO_REGLAS', 'CAMBIO_BENEFICIARIOS')),
  decision text,
  entrada jsonb not null,                  -- EntradaRegistro completa
  creado_en timestamptz not null default now()
);
create index registro_ref_idx on public.registro (ref_interna);

comment on table public.registro is 'Registro de decisiones append-only (§9). Un trigger impide editar o borrar filas, incluso con la llave secreta.';

-- Append-only en la base, no solo en la interfaz: UPDATE y DELETE fallan para todos.
create function public.registro_inmutable() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  raise exception 'El registro es append-only: no se edita ni se borra (%).', tg_op;
end;
$$;

create trigger registro_sin_update_ni_delete
  before update or delete on public.registro
  for each row execute function public.registro_inmutable();

create trigger registro_sin_truncate
  before truncate on public.registro
  for each statement execute function public.registro_inmutable();

-- Documentos recibidos (DocumentoRecibido). Los bytes viven en el bucket privado `documentos`.
create table public.documentos (
  ref_interna text primary key,
  documento jsonb,                         -- null mientras solo está el archivo (ingerir guarda el archivo primero)
  archivo_ruta text,                       -- ruta en el bucket (`{ref}/{sha256}.{ext}`)
  archivo_nombre text,
  archivo_mime text,
  creado_en timestamptz not null default now()
);

-- Versiones de reglas (la 6 y la 7 vienen de data/; las nuevas las guarda "Guardar como v8").
create table public.reglas_versiones (
  version integer primary key,
  reglas jsonb not null,
  creado_en timestamptz not null default now()
);

-- Beneficiarios agregados por una persona al aprobar (agregar_a_lista, §10). Los 14 base siguen en data/.
create table public.beneficiarios_agregados (
  id text primary key,
  beneficiario jsonb not null,
  creado_en timestamptz not null default now()
);

-- Consecutivos (ref INT por año). `minimo` deja libres las refs reservadas por el lote del escenario.
create table public.secuencias (
  nombre text primary key,
  valor bigint not null
);

create function public.siguiente_secuencia(p_nombre text, p_minimo bigint) returns bigint
  language sql
  set search_path = ''
as $$
  insert into public.secuencias (nombre, valor) values (p_nombre, p_minimo)
  on conflict (nombre) do update set valor = greatest(public.secuencias.valor + 1, excluded.valor)
  returning valor;
$$;

-- Solo el servidor. Las tablas nuevas no se exponen solas a la Data API: permisos explícitos.
alter table public.registro enable row level security;
alter table public.documentos enable row level security;
alter table public.reglas_versiones enable row level security;
alter table public.beneficiarios_agregados enable row level security;
alter table public.secuencias enable row level security;

revoke all on table public.registro, public.documentos, public.reglas_versiones, public.beneficiarios_agregados, public.secuencias
  from anon, authenticated;
-- Segunda capa del append-only: service_role recibe ALL por defecto en public; se le quita explícitamente.
revoke update, delete, truncate on table public.registro from service_role;
grant select, insert on table public.registro to service_role;
grant all on table public.documentos, public.reglas_versiones, public.beneficiarios_agregados, public.secuencias to service_role;
revoke all on function public.siguiente_secuencia(text, bigint) from public, anon, authenticated;
grant execute on function public.siguiente_secuencia(text, bigint) to service_role;

-- Bucket privado para los archivos originales (#26). Sin políticas: solo service_role accede.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 11534336)
on conflict (id) do nothing;
