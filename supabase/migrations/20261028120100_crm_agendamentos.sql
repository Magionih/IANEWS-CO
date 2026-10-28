-- Rotinas agendadas do CRM (pg_cron chama o site pelo mesmo mecanismo das outras rotinas).
--  * 11:00 UTC (8h em Brasília): automações do dia + e-mail para a equipe comercial.
--  * segunda, 11:10 UTC (8h10 em Brasília): resumo semanal para o admin.
select cron.schedule('ianews-crm-daily', '0 11 * * *', $$select public.call_site_hook('/api/public/hooks/crm-daily')$$);
select cron.schedule('ianews-crm-weekly', '10 11 * * 1', $$select public.call_site_hook('/api/public/hooks/crm-weekly')$$);
