-- Issue #76: "Reiniciar demo" en producción sin romper el registro append-only. Reiniciar = empezar una corrida
-- nueva; el repositorio solo ve la vigente y las anteriores quedan intactas (nada se borra ni se edita). La
-- función registro_inmutable() y sus triggers NO se tocan.
--
-- Por corrida: registro, documentos, secuencias (refs INT desde 000001), reglas_versiones y beneficiarios_agregados.
-- Fuera de las corridas: vinculos_telegram (no re-vincular el teléfono), equipo e invitaciones.
--
-- La corrida vigente se resuelve en la base (la última de demo_corridas), no en el proceso: dos contenedores
-- corriendo a la vez durante un deploy nunca escriben en corridas distintas.

create table public.demo_corridas (
  id bigint generated always as identity primary key,
  iniciada_en timestamptz not null default now(),
  iniciada_por text not null check (length(iniciada_por) between 1 and 320),
  escenario text not null check (length(escenario) between 1 and 80)
);

comment on table public.demo_corridas is 'Corridas de la demo (#76). La vigente es la de id más alto; las anteriores siguen en las tablas.';

insert into public.demo_corridas (iniciada_por, escenario) values ('corrida inicial', 'lote-demo-oct');

create function public.corrida_vigente() returns bigint
  language sql
  stable
  set search_path = ''
as $$
  select max(id) from public.demo_corridas;
$$;

-- Cada tabla de la demo gana corrida_id. Lo que ya existe queda en la corrida 1 (default constante: en registro el
-- ADD COLUMN no reescribe filas una por una, así que el trigger de UPDATE no participa); lo nuevo, en la vigente.
alter table public.registro add column corrida_id bigint not null default 1 references public.demo_corridas (id);
alter table public.documentos add column corrida_id bigint not null default 1 references public.demo_corridas (id);
alter table public.secuencias add column corrida_id bigint not null default 1 references public.demo_corridas (id);
alter table public.reglas_versiones add column corrida_id bigint not null default 1 references public.demo_corridas (id);
alter table public.beneficiarios_agregados add column corrida_id bigint not null default 1 references public.demo_corridas (id);

alter table public.registro alter column corrida_id set default public.corrida_vigente();
alter table public.documentos alter column corrida_id set default public.corrida_vigente();
alter table public.secuencias alter column corrida_id set default public.corrida_vigente();
alter table public.reglas_versiones alter column corrida_id set default public.corrida_vigente();
alter table public.beneficiarios_agregados alter column corrida_id set default public.corrida_vigente();

-- Unicidad por corrida: los ids REG-/INT- y las versiones de reglas vuelven a empezar en cada una.
alter table public.registro drop constraint registro_id_key;
alter table public.registro add constraint registro_corrida_id_key unique (corrida_id, id);
create index registro_corrida_orden_idx on public.registro (corrida_id, orden);
-- Huella de los enlaces de Telegram ya usados (#13): se busca en todas las corridas.
create index registro_huella_vinculo_idx on public.registro ((entrada ->> 'sha256')) where tipo = 'CAMBIO_BENEFICIARIOS';

alter table public.documentos drop constraint documentos_pkey;
alter table public.documentos add primary key (corrida_id, ref_interna);

alter table public.secuencias drop constraint secuencias_pkey;
alter table public.secuencias add primary key (corrida_id, nombre);

alter table public.reglas_versiones drop constraint reglas_versiones_pkey;
alter table public.reglas_versiones add primary key (corrida_id, version);

alter table public.beneficiarios_agregados drop constraint beneficiarios_agregados_pkey;
alter table public.beneficiarios_agregados add primary key (corrida_id, id);

-- Lo que lee el repositorio: solo la corrida vigente. security_invoker: la vista respeta los permisos de quien lee.
create view public.registro_vigente with (security_invoker = true) as
  select * from public.registro where corrida_id = public.corrida_vigente();
create view public.documentos_vigentes with (security_invoker = true) as
  select * from public.documentos where corrida_id = public.corrida_vigente();
create view public.reglas_vigentes with (security_invoker = true) as
  select * from public.reglas_versiones where corrida_id = public.corrida_vigente();
create view public.beneficiarios_agregados_vigentes with (security_invoker = true) as
  select * from public.beneficiarios_agregados where corrida_id = public.corrida_vigente();

-- Consecutivo por corrida (misma firma: la llama el código anterior durante el deploy).
create or replace function public.siguiente_secuencia(p_nombre text, p_minimo bigint) returns bigint
  language sql
  set search_path = ''
as $$
  insert into public.secuencias (nombre, valor) values (p_nombre, p_minimo)
  on conflict (corrida_id, nombre) do update set valor = greatest(public.secuencias.valor + 1, excluded.valor)
  returning valor;
$$;

-- Abre la corrida y la siembra en una sola transacción: nunca queda una corrida vigente sin reglas ni historial.
-- p_reglas: [{ version, reglas }] · p_historial: [{ id, ref_interna, tipo, decision, entrada }] (mismas filas que siembra el repositorio).
create function public.nueva_corrida_demo(p_por text, p_escenario text, p_reglas jsonb, p_historial jsonb) returns bigint
  language plpgsql
  set search_path = ''
as $$
declare
  v_id bigint;
begin
  if jsonb_typeof(p_reglas) <> 'array' or jsonb_array_length(p_reglas) = 0 then
    raise exception 'nueva_corrida_demo: hacen falta las versiones de reglas';
  end if;
  insert into public.demo_corridas (iniciada_por, escenario) values (p_por, p_escenario) returning id into v_id;
  insert into public.reglas_versiones (corrida_id, version, reglas)
    select v_id, (r ->> 'version')::integer, r -> 'reglas' from jsonb_array_elements(p_reglas) r;
  insert into public.registro (corrida_id, id, ref_interna, tipo, decision, entrada)
    select v_id, h ->> 'id', h ->> 'ref_interna', h ->> 'tipo', h ->> 'decision', h -> 'entrada'
    from jsonb_array_elements(coalesce(p_historial, '[]'::jsonb)) with ordinality as x(h, n)
    order by n;
  return v_id;
end;
$$;

-- Solo el servidor (llave secreta). Las corridas tampoco se editan ni se borran desde la app.
alter table public.demo_corridas enable row level security;
revoke all on table public.demo_corridas from anon, authenticated;
revoke update, delete, truncate on table public.demo_corridas from service_role;
grant select, insert on table public.demo_corridas to service_role;

revoke all on table public.registro_vigente, public.documentos_vigentes, public.reglas_vigentes, public.beneficiarios_agregados_vigentes
  from anon, authenticated;
grant select on table public.registro_vigente, public.documentos_vigentes, public.reglas_vigentes, public.beneficiarios_agregados_vigentes
  to service_role;

revoke all on function public.corrida_vigente() from public, anon, authenticated;
grant execute on function public.corrida_vigente() to service_role;
revoke all on function public.nueva_corrida_demo(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.nueva_corrida_demo(text, text, jsonb, jsonb) to service_role;
