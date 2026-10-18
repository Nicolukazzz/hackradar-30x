-- Issue #79: número de WhatsApp vinculado a un beneficiario (base o agregado). Un número pertenece a un solo
-- beneficiario y un beneficiario tiene un solo número. Lo escribe solo el servidor al recibir "VINCULAR <token>"
-- de un enlace firmado que generó la empresa. Igual que vinculos_telegram: no depende de la corrida de demo.

create table public.vinculos_whatsapp (
  beneficiario_id text primary key check (length(beneficiario_id) between 1 and 80),
  numero text not null unique check (numero ~ '^[0-9]{6,20}$'),
  creado_en timestamptz not null default now()
);

comment on table public.vinculos_whatsapp is 'Número de WhatsApp (E.164 sin +) de cada beneficiario (R11).';

create function public.vincular_whatsapp(p_beneficiario text, p_numero text) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  delete from public.vinculos_whatsapp where numero = p_numero or beneficiario_id = p_beneficiario;
  insert into public.vinculos_whatsapp (beneficiario_id, numero) values (p_beneficiario, p_numero);
end;
$$;

revoke all on function public.vincular_whatsapp(text, text) from public, anon, authenticated;
grant execute on function public.vincular_whatsapp(text, text) to service_role;

alter table public.vinculos_whatsapp enable row level security;
revoke all on table public.vinculos_whatsapp from anon, authenticated;
grant all on table public.vinculos_whatsapp to service_role;
