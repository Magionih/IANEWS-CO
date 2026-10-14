select cron.unschedule('ianews-daily-push') where exists (select 1 from cron.job where jobname = 'ianews-daily-push');

select cron.schedule(
  'ianews-daily-push',
  '50 10 * * *',
  $$
  select net.http_post(
    url := 'https://project--6c9f1cd5-1240-43ec-b796-da2b5afd28c5.lovable.app/api/public/hooks/daily-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);