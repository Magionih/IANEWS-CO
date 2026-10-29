import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flame, Plus } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { PessoaDialog } from "@/components/crm/dialogs";
import { usePessoas } from "@/components/crm/queries";
import {
  BotaoCsv,
  CabecalhoPagina,
  Carregando,
  Erro,
  Etiqueta,
  LinkExterno,
  Numero,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contem, fmtNum, linkInstagram, linkLinkedIn, linkWhatsApp } from "@/lib/crm/utils";

export const Route = createFileRoute("/_crm/pessoas/")({
  component: PessoasPage,
});

function PessoasPage() {
  const { membro } = useCrm();
  const navigate = useNavigate();
  const { data, isLoading, error } = usePessoas();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("ativas");
  const [nova, setNova] = useState(false);

  const recente = (v: string | null) =>
    !!v && Date.now() - new Date(v).getTime() <= 30 * 86_400_000;
  const lista = useMemo(
    () =>
      (data ?? []).filter(
        (p) =>
          (filtro === "todas" ||
            (filtro === "ativas" && p.ativo) ||
            (filtro === "inativas" && !p.ativo) ||
            (filtro === "decisores" && p.empresas.some((e) => e.decisor)) ||
            (filtro === "whatsapp" && !!p.whatsapp) ||
            (filtro === "consentiram" && p.consentimento) ||
            (filtro === "assinantes" && p.assinante) ||
            (filtro === "aquecidos" && recente(p.aquecido_em)) ||
            (filtro === "apareceram" && p.mencoes > 0)) &&
          contem(
            [
              p.nome,
              p.email,
              p.instagram,
              p.whatsapp,
              ...p.empresas.map((e) => e.nome),
              ...p.empresas.map((e) => e.cargo),
            ],
            q,
          ),
      ),
    [data, q, filtro],
  );
  const ativas = (data ?? []).filter((p) => p.ativo);

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Pessoas"
        descricao="Fundadores, executivos e contatos. Uma pessoa por e-mail; pode estar ligada a mais de uma empresa."
        acoes={
          <>
            <BotaoCsv
              nome="pessoas"
              linhas={lista}
              colunas={[
                { titulo: "Nome", valor: (p) => p.nome },
                { titulo: "Empresas", valor: (p) => p.empresas.map((e) => e.nome) },
                { titulo: "Cargos", valor: (p) => p.empresas.map((e) => e.cargo).filter(Boolean) },
                { titulo: "Decisor", valor: (p) => p.empresas.some((e) => e.decisor) },
                { titulo: "E-mail", valor: (p) => p.email },
                { titulo: "WhatsApp", valor: (p) => p.whatsapp },
                { titulo: "Instagram", valor: (p) => p.instagram },
                { titulo: "LinkedIn", valor: (p) => p.linkedin },
                { titulo: "Seguidores", valor: (p) => p.seguidores_instagram },
                { titulo: "Consentimento", valor: (p) => p.consentimento },
                { titulo: "Consentimento em", valor: (p) => p.consentimento_em },
                { titulo: "Assinante da newsletter", valor: (p) => p.assinante },
                { titulo: "Menções", valor: (p) => p.mencoes },
                { titulo: "Origem", valor: (p) => p.origem },
                { titulo: "Dono", valor: (p) => membro(p.dono_id) },
                { titulo: "Cadastrada em", valor: (p) => p.created_at },
              ]}
            />
            <Button size="sm" className="h-9" onClick={() => setNova(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova pessoa
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Pessoas ativas" valor={fmtNum(ativas.length)} />
        <Numero rotulo="Com WhatsApp" valor={fmtNum(ativas.filter((p) => p.whatsapp).length)} />
        <Numero rotulo="Consentiram" valor={fmtNum(ativas.filter((p) => p.consentimento).length)} />
        <Numero
          rotulo="Assinam a newsletter"
          valor={fmtNum(ativas.filter((p) => p.assinante).length)}
          destaque="azul"
        />
      </section>

      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por nome, e-mail, Instagram, WhatsApp, empresa ou cargo"
          className="h-10"
        />
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="decisores">Decisores</SelectItem>
            <SelectItem value="whatsapp">Com WhatsApp</SelectItem>
            <SelectItem value="consentiram">Consentiram</SelectItem>
            <SelectItem value="assinantes">Assinantes da newsletter</SelectItem>
            <SelectItem value="aquecidos">Aquecidos (30 dias)</SelectItem>
            <SelectItem value="apareceram">Já apareceram em conteúdo</SelectItem>
            <SelectItem value="inativas">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Carregando />
      ) : error ? (
        <Erro erro={error} />
      ) : lista.length ? (
        <div className="overflow-x-auto rounded-[var(--radius)] border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Pessoa</th>
                <th className="px-3 py-2">Empresa e cargo</th>
                <th className="px-3 py-2">Contato</th>
                <th className="px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate({ to: "/pessoas/$id", params: { id: p.id } })}
                >
                  <td className="px-3 py-2">
                    <Link
                      to="/pessoas/$id"
                      params={{ id: p.id }}
                      className="font-semibold hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.nome}
                    </Link>
                    {p.email ? <p className="text-xs text-muted-foreground">{p.email}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.empresas.length
                      ? p.empresas.map((e) => (
                          <span key={e.id} className="block">
                            <span className="font-medium">{e.nome}</span>
                            {e.cargo ? (
                              <span className="text-muted-foreground"> · {e.cargo}</span>
                            ) : null}
                            {e.decisor ? <span className="text-primary"> · decisor</span> : null}
                          </span>
                        ))
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <LinkExterno href={linkWhatsApp(p.whatsapp)}>WhatsApp</LinkExterno>
                      <LinkExterno href={linkInstagram(p.instagram)}>Instagram</LinkExterno>
                      <LinkExterno href={linkLinkedIn(p.linkedin)}>LinkedIn</LinkExterno>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.consentimento ? (
                        <Etiqueta tom="ok">consentiu</Etiqueta>
                      ) : (
                        <Etiqueta>sem consentimento</Etiqueta>
                      )}
                      {p.assinante ? <Etiqueta tom="azul">assinante</Etiqueta> : null}
                      {recente(p.aquecido_em) ? (
                        <Etiqueta tom="alerta">
                          <Flame className="h-3 w-3" /> aquecido
                        </Etiqueta>
                      ) : null}
                      {p.mencoes ? <Etiqueta tom="alerta">apareceu {p.mencoes}x</Etiqueta> : null}
                      {!p.ativo ? <Etiqueta>inativa</Etiqueta> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Vazio>Nenhuma pessoa com esses filtros.</Vazio>
      )}

      <PessoaDialog
        aberto={nova}
        onClose={() => setNova(false)}
        onSalva={(id) => navigate({ to: "/pessoas/$id", params: { id } })}
      />
    </div>
  );
}
