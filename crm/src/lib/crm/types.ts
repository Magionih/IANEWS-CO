/* Tipos do CRM interno (tabelas crm_* do Supabase). Compartilhados entre servidor e telas. */

export type CrmFunilId = "materia" | "publicidade" | "parcerias";
export type CrmEtapaTipo = "aberta" | "ganha" | "perdida";
export type CrmGrupo = "A" | "B" | "C";
export type CrmPorte = "startup" | "pme" | "grande" | "global";
export type CrmStatusPagamento = "pendente" | "pago" | "cortesia" | "cancelado";
export type CrmPapelMencao = "protagonista" | "citada" | "colaboradora";
export type CrmCanalConteudo =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "threads"
  | "newsletter"
  | "site";
export type CrmCampanhaStatus = "planejada" | "em_veiculacao" | "concluida" | "cancelada";
export type CrmAtividadeTipo =
  | "mensagem_enviada"
  | "mensagem_recebida"
  | "ligacao"
  | "reuniao"
  | "nota"
  | "mudanca_etapa"
  | "email"
  | "proposta"
  | "pagamento"
  | "sistema";

export type CrmFunil = { id: CrmFunilId; nome: string; ordem: number; ativo: boolean };

export type CrmEtapa = {
  id: string;
  funil_id: CrmFunilId;
  nome: string;
  ordem: number;
  prazo_dias: number | null;
  acao_padrao: string | null;
  criterio_entrada: string | null;
  tipo: CrmEtapaTipo;
  ativo: boolean;
};

export type CrmMembro = { user_id: string; nome: string; email: string; papeis: string[] };

export type CrmEmpresa = {
  id: string;
  nome: string;
  slug: string | null;
  site: string | null;
  dominio: string | null;
  instagram: string | null;
  linkedin: string | null;
  setor: string | null;
  cidade: string | null;
  pais: string | null;
  brasileira: boolean | null;
  porte: CrmPorte | null;
  seguidores_instagram: number | null;
  descricao: string | null;
  pontuacao: number;
  grupo: CrmGrupo | null;
  grupo_manual: boolean;
  motivo_grupo: string | null;
  interagiu: boolean;
  noticia_recente_em: string | null;
  e_cliente: boolean;
  e_anunciante: boolean;
  origem: string | null;
  dono_id: string | null;
  ai_tool_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmPessoa = {
  id: string;
  nome: string;
  instagram: string | null;
  linkedin: string | null;
  whatsapp: string | null;
  email: string | null;
  seguidores_instagram: number | null;
  consentimento: boolean;
  consentimento_em: string | null;
  origem: string | null;
  newsletter_lead_id: string | null;
  aquecido_em: string | null;
  notas: string | null;
  dono_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmVinculo = {
  empresa_id: string;
  pessoa_id: string;
  cargo: string | null;
  decisor: boolean;
};

export type CrmNegocio = {
  id: string;
  titulo: string;
  funil_id: CrmFunilId;
  etapa_id: string;
  etapa_desde: string;
  empresa_id: string | null;
  pessoa_id: string | null;
  tipo: string | null;
  valor: number | null;
  status_pagamento: CrmStatusPagamento;
  origem: string | null;
  canal_origem: string | null;
  article_id: string | null;
  conteudo_id: string | null;
  pauta_lead_id: string | null;
  contact_message_id: string | null;
  dono_id: string | null;
  proxima_acao: string | null;
  proxima_acao_em: string | null;
  motivo_perda: string | null;
  fechado_em: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

/** Negócio com os nomes já resolvidos para cartões e listas. */
export type CrmNegocioCard = CrmNegocio & {
  empresa_nome: string | null;
  empresa_grupo: CrmGrupo | null;
  empresa_seguidores: number | null;
  pessoa_nome: string | null;
  pessoa_whatsapp: string | null;
  article_slug: string | null;
  article_title: string | null;
  /** Link do post nas redes (conteúdo que originou o negócio). */
  post_url: string | null;
};

export type CrmAtividade = {
  id: string;
  tipo: CrmAtividadeTipo;
  canal: string | null;
  texto: string | null;
  empresa_id: string | null;
  pessoa_id: string | null;
  negocio_id: string | null;
  etapa_de: string | null;
  etapa_para: string | null;
  modelo_id: string | null;
  autor_id: string | null;
  created_at: string;
};

export type CrmTarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  vence_em: string | null;
  feita: boolean;
  feita_em: string | null;
  cancelada: boolean;
  automatica: boolean;
  responsavel_id: string | null;
  empresa_id: string | null;
  pessoa_id: string | null;
  negocio_id: string | null;
  created_at: string;
};

export type CrmTarefaItem = CrmTarefa & {
  empresa_nome: string | null;
  pessoa_nome: string | null;
  negocio_titulo: string | null;
};

export type CrmConteudo = {
  id: string;
  article_id: string | null;
  canal: CrmCanalConteudo;
  formato: string | null;
  titulo: string | null;
  url: string | null;
  publicado_em: string | null;
  collab_aceito: boolean | null;
  ativo: boolean;
  created_at: string;
};

export type CrmMencao = {
  id: string;
  article_id: string | null;
  conteudo_id: string | null;
  empresa_id: string | null;
  pessoa_id: string | null;
  papel: CrmPapelMencao;
  ativo: boolean;
  created_at: string;
};

export type CrmCampanha = {
  id: string;
  negocio_id: string | null;
  nome: string;
  inicio: string | null;
  fim: string | null;
  status: CrmCampanhaStatus;
  relatorio_url: string | null;
  relatorio_enviado_em: string | null;
  notas: string | null;
  created_at: string;
};

export type CrmEntrega = {
  id: string;
  campanha_id: string;
  formato: string | null;
  canal: string | null;
  titulo: string | null;
  agendado_para: string | null;
  url: string | null;
  entregue: boolean;
  entregue_em: string | null;
};

export type CrmModelo = {
  id: string;
  nome: string;
  canal: string | null;
  etapa_id: string | null;
  texto: string;
  ordem: number;
  ativo: boolean;
};

/** Contexto comum das telas: quem sou eu, equipe, funis e etapas. */
export type CrmContexto = {
  userId: string;
  papeis: string[];
  isAdmin: boolean;
  equipe: CrmMembro[];
  funis: CrmFunil[];
  etapas: CrmEtapa[];
};
