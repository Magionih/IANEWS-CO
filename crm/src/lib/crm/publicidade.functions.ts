import { createServerFn } from "@tanstack/react-start";

import {
  bool,
  checar,
  dia,
  instante,
  obrigatorio,
  requireCrmAccess,
  texto,
  todas,
  umDe,
  url,
  uuid,
  uuidObrigatorio,
} from "./access";
import { carregarNegocios, type NegocioCompleto } from "./carregar";
import type { CrmCampanha, CrmEmpresa, CrmEntrega } from "./types";

/* Publicidade: anunciantes, campanhas vendidas, peças a entregar e relatório de entrega.
   Relatório anexado conclui a campanha e cria a tarefa de renovação em 30 dias (gatilho no banco). */

const STATUS = ["planejada", "em_veiculacao", "concluida", "cancelada"] as const;

export type DadosPublicidade = {
  anunciantes: Pick<
    CrmEmpresa,
    "id" | "nome" | "grupo" | "pontuacao" | "e_anunciante" | "site" | "instagram"
  >[];
  negocios: NegocioCompleto[];
  campanhas: CrmCampanha[];
  entregas: CrmEntrega[];
};

export const getPublicidade = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<DadosPublicidade> => {
    const { db } = context;
    const [negocios, campanhas, entregas] = await Promise.all([
      carregarNegocios(db, (q) => q.eq("funil_id", "publicidade"), { incluirInativos: false }),
      todas<CrmCampanha>((de, ate) =>
        db.from("crm_campanhas").select("*").order("inicio", { ascending: false }).range(de, ate),
      ),
      todas<CrmEntrega>((de, ate) =>
        db
          .from("crm_entregas")
          .select("*")
          .order("agendado_para", { ascending: true, nullsFirst: false })
          .range(de, ate),
      ),
    ]);
    const idsComNegocio = [
      ...new Set(negocios.map((n) => n.empresa_id).filter(Boolean)),
    ] as string[];
    const filtro = idsComNegocio.length
      ? `e_anunciante.eq.true,id.in.(${idsComNegocio.join(",")})`
      : "e_anunciante.eq.true";
    const anunciantes = (checar(
      await db
        .from("crm_empresas")
        .select("id, nome, grupo, pontuacao, e_anunciante, site, instagram")
        .or(filtro)
        .order("nome")
        .limit(1000),
    ) ?? []) as DadosPublicidade["anunciantes"];
    return { anunciantes, negocios, campanhas, entregas };
  });

export type CampanhaInput = {
  id?: string;
  negocio_id?: string | null;
  nome?: string;
  inicio?: string | null;
  fim?: string | null;
  status?: CrmCampanha["status"];
  relatorio_url?: string | null;
  notas?: string | null;
};

export const saveCampanha = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: CampanhaInput) => input)
  .handler(async ({ data, context }) => {
    const row: Record<string, unknown> = {};
    const campo = <K extends keyof CampanhaInput>(k: K, valor: () => unknown) => {
      if (k in data) row[k] = valor();
    };
    if (!data.id || "nome" in data) row.nome = obrigatorio(data.nome, "o nome da campanha", 200);
    campo("negocio_id", () => uuid(data.negocio_id));
    campo("inicio", () => dia(data.inicio));
    campo("fim", () => dia(data.fim));
    campo("status", () => umDe(data.status, STATUS, "Status") ?? "planejada");
    campo("relatorio_url", () => url(data.relatorio_url));
    campo("notas", () => texto(data.notas, 4000));
    if (row.inicio && row.fim && String(row.fim) < String(row.inicio))
      throw new Error("O fim não pode ser antes do início.");
    if (data.id) {
      const id = uuidObrigatorio(data.id, "a campanha");
      checar(await context.db.from("crm_campanhas").update(row).eq("id", id).select("id").single());
      return { id };
    }
    const nova = checar(
      await context.db.from("crm_campanhas").insert(row).select("id").single(),
    ) as { id: string };
    return { id: nova.id };
  });

export type EntregaInput = {
  id?: string;
  campanha_id?: string;
  formato?: string | null;
  canal?: string | null;
  titulo?: string | null;
  agendado_para?: string | null;
  url?: string | null;
  entregue?: boolean;
};

export const saveEntrega = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: EntregaInput) => input)
  .handler(async ({ data, context }) => {
    const row: Record<string, unknown> = {};
    const campo = <K extends keyof EntregaInput>(k: K, valor: () => unknown) => {
      if (k in data) row[k] = valor();
    };
    if (!data.id) row.campanha_id = uuidObrigatorio(data.campanha_id, "a campanha");
    campo("formato", () => texto(data.formato, 40));
    campo("canal", () => texto(data.canal, 40));
    campo("titulo", () => texto(data.titulo, 300));
    campo("agendado_para", () => instante(data.agendado_para));
    campo("url", () => url(data.url));
    campo("entregue", () => bool(data.entregue));
    if (data.id) {
      const id = uuidObrigatorio(data.id, "a entrega");
      checar(await context.db.from("crm_entregas").update(row).eq("id", id).select("id").single());
      return { id };
    }
    const nova = checar(
      await context.db.from("crm_entregas").insert(row).select("id").single(),
    ) as { id: string };
    return { id: nova.id };
  });
