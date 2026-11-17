-- Verticais da IA News: cada funil pertence a uma vertical (Ativação, Publicidade, Eventos, Conselho, Parcerias).
alter table public.crm_funis add column if not exists vertical text;
alter table public.crm_funis add column if not exists descricao text;

-- Funil do Palco presencial em BH (11/02/2027): ingressos. Patrocínio fica no funil de Publicidade.
insert into public.crm_funis (id, nome, ordem, ativo) values ('presencial', 'Palco presencial BH · 11/02/27', 22, true)
on conflict (id) do nothing;
insert into public.crm_etapas (funil_id, nome, ordem, prazo_dias, acao_padrao, criterio_entrada, tipo)
select * from (values
  ('presencial','Interessado',1,3,'Enviar o convite do Palco presencial','Mostrou interesse no evento (Aula, Palco online, canal ou conversa).','aberta'),
  ('presencial','Lista de espera',2,null,null,'Entrou na lista de espera; recebe a abertura dos ingressos primeiro.','aberta'),
  ('presencial','Convite enviado',3,4,'Retomar o convite e tirar dúvidas','Recebeu o link de compra do ingresso.','aberta'),
  ('presencial','Ingresso pago',90,null,null,'Comprou o ingresso.','ganha'),
  ('presencial','Presente',91,null,null,'Esteve no evento.','ganha'),
  ('presencial','Não vai',99,null,null,'Disse que não vai ou não comprou depois da abertura.','perdida')
) v(funil_id,nome,ordem,prazo_dias,acao_padrao,criterio_entrada,tipo)
where not exists (select 1 from public.crm_etapas e where e.funil_id='presencial');

update public.crm_funis f set vertical = v.vertical, descricao = v.descricao, ordem = v.ordem
from (values
  ('ativacao','Ativação e base','Régua de 7 toques que leva cada lead da base a uma vertical.',1),
  ('nutricao','Ativação e base','Canal das 7h e newsletter: onde o lead fica recebendo valor.',2),
  ('materia','Publicidade','Matéria de destaque, paga ou cortesia com collab.',10),
  ('publicidade','Publicidade','Planos Presença, Autoridade e Patrocínio para empresas.',11),
  ('aula','Eventos','Aula ao vivo mensal e gratuita: primeiro encontro com a IA News.',20),
  ('evento','Eventos','Palco IA News online de 16/12.',21),
  ('presencial','Eventos','Palco presencial em BH, 11/02/2027: ingressos.',22),
  ('lista100','Conselho','Lista IA News 100: reconhecimento que abre a porta do Conselho.',30),
  ('conselho','Conselho','Conselho IA News: clube pago e curado de empresários de IA.',31),
  ('implementacao','Conselho','Balcão de Projetos: pedidos de empresas atendidos por membros do Conselho.',32),
  ('parcerias','Parcerias','Aceleradoras, hubs, comunidades, veículos e eventos parceiros.',40)
) v(id, vertical, descricao, ordem)
where f.id = v.id;

-- Resumo por etapa (respeita a RLS de quem consulta).
create or replace view public.crm_visao_etapas with (security_invoker = on) as
select n.funil_id, n.etapa_id,
  count(*)::int as qtd,
  coalesce(sum(n.valor), 0)::numeric as valor,
  count(*) filter (where n.status_pagamento = 'pago')::int as pagos,
  count(*) filter (where n.proxima_acao_em is null or n.proxima_acao_em < crm_hoje())::int as atencao,
  count(*) filter (where n.etapa_desde >= now() - interval '7 days')::int as entraram_7d,
  count(*) filter (where n.created_at >= now() - interval '7 days')::int as novos_7d,
  count(*) filter (where n.proxima_acao_em = crm_hoje())::int as hoje
from public.crm_negocios n
where n.ativo
group by n.funil_id, n.etapa_id;

grant select on public.crm_visao_etapas to authenticated;
