-- Checkout próprio do Palco IA News Online (10/11/2026): cada inscrição ganha um token secreto para abrir
-- /palco/checkout, e guarda a cobrança do Asaas (cliente, cobrança, forma e valor). O webhook do Asaas marca
-- status = 'pago', e o gatilho palco_inscricao_status já leva o negócio para Confirmado no CRM.
create extension if not exists pgcrypto;

alter table palco_inscricoes
  add column if not exists checkout_token text not null default encode(gen_random_bytes(18), 'hex'),
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_payment_id text,
  add column if not exists pagamento_metodo text,
  add column if not exists pagamento_valor numeric(10,2),
  add column if not exists pagamento_atualizado_em timestamptz,
  add column if not exists pago_em timestamptz;

create unique index if not exists palco_inscricoes_checkout_token_idx on palco_inscricoes (checkout_token);
create index if not exists palco_inscricoes_asaas_payment_idx on palco_inscricoes (asaas_payment_id);
