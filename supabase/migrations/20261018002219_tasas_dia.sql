-- #86: foto diaria de las tasas de cambio (1 base = X moneda) desde una fuente pública. El motor nunca llama a la red:
-- recibe la foto ya guardada. Si la fuente falla, se usa la última foto; sin ninguna, las monedas distintas a la base
-- escalan por R1. Solo servidor (llave secreta).

create table public.tasas_dia (
  fecha date not null,
  base text not null check (base ~ '^[A-Z]{3,4}$'),
  tasas jsonb not null check (jsonb_typeof(tasas) = 'object'),
  fuente text not null check (length(fuente) between 1 and 80),
  obtenida_en timestamptz not null default now(),
  primary key (base, fecha)
);

comment on table public.tasas_dia is 'Tasas de cambio del día por moneda base (#86). Una foto por día; la del motor es la del día o la última.';

alter table public.tasas_dia enable row level security;
revoke all on table public.tasas_dia from anon, authenticated;
grant select, insert, update on table public.tasas_dia to service_role;
