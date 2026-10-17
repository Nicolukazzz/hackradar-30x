-- Issue #13: chat de Telegram vinculado a un beneficiario (base de data/proveedores.json o agregado). Un chat
-- pertenece a un solo beneficiario y un beneficiario tiene un solo chat. Lo escribe solo el servidor al recibir
-- /start <token> de un enlace firmado que generó la empresa.

create table public.vinculos_telegram (
  beneficiario_id text primary key check (length(beneficiario_id) between 1 and 80),
  chat_id text not null unique check (chat_id ~ '^-?[0-9]{1,20}$'),
  creado_en timestamptz not null default now()
);

comment on table public.vinculos_telegram is 'Chat de Telegram de cada beneficiario (R11). Reemplaza el telegram_chat_id de data/proveedores.json.';

-- Reemplazar el vínculo es atómico: borra el anterior del chat y del beneficiario e inserta el nuevo.
create function public.vincular_telegram(p_beneficiario text, p_chat text) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  delete from public.vinculos_telegram where chat_id = p_chat or beneficiario_id = p_beneficiario;
  insert into public.vinculos_telegram (beneficiario_id, chat_id) values (p_beneficiario, p_chat);
end;
$$;

revoke all on function public.vincular_telegram(text, text) from public, anon, authenticated;
grant execute on function public.vincular_telegram(text, text) to service_role;

alter table public.vinculos_telegram enable row level security;
revoke all on table public.vinculos_telegram from anon, authenticated;
grant all on table public.vinculos_telegram to service_role;
