-- Carga inicial do CRM: empresas e pessoas citadas nas matérias já publicadas, com as menções.
-- Levantamento feito a partir dos títulos e tags das matérias (revisado à mão).
-- Pode rodar de novo sem duplicar: empresa é achada pelo nome, pessoa pelo nome, menção é única.
do $$
declare
  r record;
  v_art uuid;
  v_emp uuid;
  v_pes uuid;
begin
  for r in
    select * from (values
      -- slug, empresa, brasileira, pessoa, cargo, papel
      ('vammo-tem-mais-clientes-do-que-motos-e-quer-chegar-a-15-mil-eletricas-nas-ruas', 'Vammo', true, null, null, 'protagonista'),
      ('boston-dynamics-agora-sob-o-comando-de-rohit-prasad-da-ao-robo-atlas-m', 'Boston Dynamics', false, 'Rohit Prasad', 'CEO', 'protagonista'),
      ('kadu-monguilhott-strattum-big-tech-brasileira-tropicalia', 'Strattum', true, 'Kadu Monguilhott', 'Fundador e CEO', 'protagonista'),
      ('pluginbot-leva-robo-humanoide-de-r-200-mil-para-a-seguranca-do-rock-in-rio', 'Pluginbot', true, null, null, 'protagonista'),
      ('runway-de-cristobal-valenzuela-mostra-um-comercial-criado-por-uma-unic', 'Runway', false, 'Cristóbal Valenzuela', 'Cofundador e CEO', 'protagonista'),
      ('cury-agente-ia-cobranca-r-700-mil-primeiro-mes', 'Cury', true, null, null, 'protagonista'),
      ('klaus-riffel-da-doc9-poe-a-inteligencia-artificial-para-trabalhar-nos', 'Doc9', true, 'Klaus Riffel', 'Fundador', 'protagonista'),
      ('crispim-neto-da-raytchel-cria-sistema-para-nenhuma-venda-se-perder-no-whatsapp', 'Raytchel', true, 'Crispim Neto', 'Fundador', 'protagonista'),
      ('lucas-danicek-nexa-ia-investimento-sob-medida-dois-minutos', 'Nexa', true, 'Lucas Danicek', 'Fundador', 'protagonista'),
      ('unitree-de-wang-xingxing-apresenta-o-h2-x-humanoide-kung-fu-com-cerca', 'Unitree', false, 'Wang Xingxing', 'Fundador e CEO', 'protagonista'),
      ('eve-do-carro-voador-brasileiro-parte-para-os-prototipos-de-certificacao', 'Eve Air Mobility', true, null, null, 'protagonista'),
      ('itau-de-milton-maluhy-filho-compra-neospace-r-2-9-bilhoes-ia', 'Itaú Unibanco', true, 'Milton Maluhy Filho', 'CEO', 'protagonista'),
      ('itau-de-milton-maluhy-filho-compra-neospace-r-2-9-bilhoes-ia', 'NeoSpace', true, null, null, 'citada'),
      ('tractian-capta-us-130-milhoes-e-passa-a-valer-us-1-4-bilhao', 'Tractian', true, null, null, 'protagonista'),
      ('sandro-valeri-pulso-ai-startup-uma-pessoa-14-agentes', 'Pulso AI', true, 'Sandro Valeri', 'Fundador', 'protagonista'),
      ('rodrigo-brando-beefsystem-dados-ia-confinamento', 'BeefSystem', true, 'Rodrigo Brando', 'Fundador', 'protagonista'),
      ('speedbird-leva-entregas-por-drone-do-ifood-e-agora-vai-transportar-exames-na-serra-gaucha', 'Speedbird Aero', true, null, null, 'protagonista'),
      ('andre-florence-alice-r-1-bilhao-receita-ia-us-40-milhoes', 'Alice', true, 'André Florence', 'Cofundador e CEO', 'protagonista'),
      ('luis-roquette-da-cf-gauss-leva-ia-aplicada-a-globo-localiza-e-mrv', 'CF Gauss', true, 'Luis Roquette', 'Fundador', 'protagonista'),
      ('carlos-schmiedel-draiven-premio-global-ia-taipe', 'Draiven', true, 'Carlos Schmiedel', 'Fundador', 'protagonista'),
      ('pulverizador-autonomo-da-jacto-comeca-a-operar-nos-laranjais-da-citrosuco', 'Jacto', true, null, null, 'protagonista'),
      ('pulverizador-autonomo-da-jacto-comeca-a-operar-nos-laranjais-da-citrosuco', 'Citrosuco', true, null, null, 'citada'),
      ('startup-nascida-na-ufg-cria-robo-que-limpa-grandes-areas-sozinho', 'Synkar', true, null, null, 'protagonista'),
      ('max-peters-adapta-200-mil-clientes-consultoria-ia', 'Adapta', true, 'Max Peters', 'Fundador e CEO', 'protagonista'),
      ('kepler-weber-lanca-a-olga-ia-assistente-que-orienta-quem-opera-suas-maquinas', 'Kepler Weber', true, null, null, 'protagonista'),
      ('vinicius-ribeiro-huna-ia-hemograma-cancer', 'Huna', true, 'Vinicius Ribeiro', 'Fundador', 'protagonista'),
      ('mona-oliveira-biolinker-ia-amazonia-r-8-milhoes', 'BioLinker', true, 'Mona Oliveira', 'Fundadora e CEO', 'protagonista'),
      ('fabrica-da-purina-produz-170-mil-toneladas-por-ano-com-a-ajuda-de-19-robos', 'Nestlé Purina', true, null, null, 'protagonista'),
      ('gustavo-usero-minemind-ia-mineracao-us-1-milhao-veteranos-vale', 'MineMind', true, 'Gustavo Usero', 'Fundador', 'protagonista'),
      ('startup-capixaba-coloca-caminhoes-sem-motorista-para-rodar-dentro-das-fabricas', 'Lume Robotics', true, null, null, 'protagonista'),
      ('nicolas-camara-firecrawl-r-400-milhoes-40-mil-clientes-brasil', 'Firecrawl', true, 'Nicolas Camara', 'Cofundador', 'protagonista'),
      ('xmobots-ja-investiu-mais-de-r-220-milhoes-em-drones-de-defesa-feitos-no-brasil', 'Xmobots', true, null, null, 'protagonista'),
      ('davi-holanda-jota-ia-whatsapp-400-mil-clientes', 'Jota', true, 'Davi Holanda', 'Fundador', 'protagonista'),
      ('pedro-salles-inner-ai-vivo-agentes-ia-pequenas-empresas', 'Inner AI', true, 'Pedro Salles', 'Fundador e CEO', 'protagonista'),
      ('pedro-salles-inner-ai-vivo-agentes-ia-pequenas-empresas', 'Vivo', true, null, null, 'citada'),
      ('solinftec-robo-solix-espanha-europa', 'Solinftec', true, null, null, 'protagonista'),
      ('itau-ia-i-inteligencia-artificial-generativa-toda-base-de-clientes', 'Itaú Unibanco', true, null, null, 'protagonista'),
      ('embraer-smart-planning-ia-2-tb-dados-suprimentos', 'Embraer', true, null, null, 'protagonista'),
      ('petrobras-sapiens-bot-ia-92-acuracia-perdas-producao', 'Petrobras', true, 'Magda Chambriard', 'Presidente', 'protagonista'),
      ('guilherme-benchimol-xp-potencia-ia-dobra-quatro-meses', 'XP Inc.', true, 'Guilherme Benchimol', 'Fundador', 'protagonista'),
      ('silvio-meira-porto-digital-aplicativo-vai-morrer-agentes-ia', 'Porto Digital', true, 'Silvio Meira', 'Fundador e presidente do conselho', 'protagonista'),
      ('laercio-cosentino-totvs-ia-28-por-cento-nova-receita-recorrente', 'Totvs', true, 'Laércio Cosentino', 'Fundador e presidente do conselho', 'protagonista'),
      ('nizan-guanaes-nizai-ia-pequenas-empresas', 'NizAI', true, 'Nizan Guanaes', 'Fundador', 'protagonista'),
      ('bradesco-bia-74-milhoes-transacoes-ia-generativa', 'Bradesco', true, 'Marcelo Noronha', 'CEO', 'protagonista'),
      ('cacau-show-ia-redes-sociais-26-minutos', 'Cacau Show', true, 'Alê Costa', 'Fundador', 'protagonista'),
      ('rubens-menin-mrv-inter-seven-38-milhoes-conversas-ia', 'MRV', true, 'Rubens Menin', 'Fundador', 'protagonista'),
      ('rubens-menin-mrv-inter-seven-38-milhoes-conversas-ia', 'Banco Inter', true, null, null, 'citada'),
      ('marcos-lucas-adam-cotech-ia-consultoria-pme', 'Cotech', true, 'Marcos Adam', 'Cofundador', 'protagonista'),
      ('marcos-lucas-adam-cotech-ia-consultoria-pme', 'Cotech', true, 'Lucas Adam', 'Cofundador', 'protagonista'),
      ('quintoandar-domi-ia-responde-clientes-imobiliarias', 'QuintoAndar', true, null, null, 'protagonista'),
      ('fabricio-bloisi-prosus-30-mil-agentes-de-ia', 'Prosus', true, 'Fabricio Bloisi', 'CEO', 'protagonista'),
      ('fabricio-bloisi-prosus-30-mil-agentes-de-ia', 'iFood', true, null, null, 'citada'),
      ('henrique-dubugras-brex-capital-one-agentes-de-ia', 'Brex', false, 'Henrique Dubugras', 'Cofundador', 'protagonista'),
      ('cristiano-amon-qualcomm-de-campinas-ao-comando', 'Qualcomm', false, 'Cristiano Amon', 'CEO', 'protagonista'),
      ('mike-krieger-instagram-anthropic-labs', 'Anthropic', false, 'Mike Krieger', 'Labs', 'protagonista'),
      ('stefanini-forma-1500-arquitetos-de-ia-anthropic', 'Stefanini', true, null, null, 'protagonista'),
      ('stefanini-forma-1500-arquitetos-de-ia-anthropic', 'Anthropic', false, null, null, 'citada'),
      ('atento-100-mil-entrevistas-de-emprego-com-ia-no-whatsapp', 'Atento', true, null, null, 'protagonista'),
      ('ploomes-investe-25-milhoes-estudio-ia-crm', 'Ploomes', true, null, null, 'protagonista'),
      ('mat-velloso-brasil-colonizado-digitalmente', 'Docker', false, 'Mat Velloso', 'Executivo', 'protagonista'),
      ('frederico-trajano-magalu-cerebro-da-lu', 'Magalu', true, 'Frederico Trajano', 'CEO', 'protagonista'),
      ('nvidia-america-latina-milhares-de-agentes-de-ia', 'NVIDIA', true, 'Marcio Aguiar', 'Diretor para a América Latina', 'protagonista')
    ) as t(slug, empresa, brasileira, pessoa, cargo, papel)
  loop
    select id into v_art from public.articles where slug = r.slug;
    if v_art is null then continue; end if;

    select id into v_emp from public.crm_empresas where lower(trim(nome)) = lower(r.empresa);
    if v_emp is null then
      insert into public.crm_empresas (nome, brasileira, pais, origem)
      values (r.empresa, r.brasileira, case when r.brasileira then 'Brasil' else null end, 'materia')
      returning id into v_emp;
    end if;

    v_pes := null;
    if r.pessoa is not null then
      select id into v_pes from public.crm_pessoas where lower(trim(nome)) = lower(r.pessoa) limit 1;
      if v_pes is null then
        insert into public.crm_pessoas (nome, origem) values (r.pessoa, 'materia') returning id into v_pes;
      end if;
      insert into public.crm_empresa_pessoas (empresa_id, pessoa_id, cargo, decisor)
      values (v_emp, v_pes, r.cargo, true)
      on conflict (empresa_id, pessoa_id) do nothing;
    end if;

    insert into public.crm_mencoes (article_id, empresa_id, pessoa_id, papel, created_by)
    values (v_art, v_emp, v_pes, r.papel, null)
    on conflict do nothing;
  end loop;
end $$;
