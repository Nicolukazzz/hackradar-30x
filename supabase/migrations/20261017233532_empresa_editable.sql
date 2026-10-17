-- #84: los datos de la empresa viven en la base (antes, fijos en data/empresa.json y en el código).
-- Se editan desde Ajustes → Datos de la empresa (nombre, jurisdicción, países). Moneda y zona horaria quedan
-- guardadas aquí para #86; `codigo` es el identificador público del enlace de proveedores (#85).
-- No se reinician con "Reiniciar demo" (#76): la empresa no es parte de una corrida.

alter table public.empresas
  add column jurisdiccion text not null default '' check (length(jurisdiccion) <= 120),
  add column paises_operacion text[] not null default '{}' check (cardinality(paises_operacion) <= 30),
  add column moneda_base text not null default 'USD' check (moneda_base ~ '^[A-Z]{3,4}$'),
  add column zona_horaria text not null default 'America/Bogota' check (length(zona_horaria) between 1 and 60),
  add column codigo text unique check (codigo ~ '^[a-z0-9-]{3,40}$'),
  add column actualizada_en timestamptz not null default now();

-- Mismos valores que data/empresa.json.
update public.empresas
set jurisdiccion = 'Delaware, EE. UU.',
    paises_operacion = array['US', 'CO', 'MX', 'AR', 'BR'],
    moneda_base = 'USD',
    zona_horaria = 'America/Bogota',
    codigo = 'nebula'
where id = 'nebula' and jurisdiccion = '';

comment on column public.empresas.codigo is 'Identificador público de la empresa en el enlace de proveedores (/enviar/<codigo>, #85).';

-- Cambiar los datos de la empresa queda en el registro como CAMBIO_EMPRESA.
alter table public.registro drop constraint registro_tipo_check;
alter table public.registro
  add constraint registro_tipo_check check (tipo in ('DECISION_AGENTE', 'DECISION_HUMANA', 'CAMBIO_REGLAS', 'CAMBIO_BENEFICIARIOS', 'CAMBIO_EMPRESA'));
