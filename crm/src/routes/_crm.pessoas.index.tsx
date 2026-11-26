import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flame, Mail, Phone, Plus, Search, UsersRound } from "lucide-react";

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
  Avatar,
  BarraFerramentas,
  Paginacao,
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

const POR_PAGINA = 100;

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
  const [pagina, setPagina] = useState(0);

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
              <Plus className="h-4 w-4" /> Nova pessoa
            </Button>
          </>
        }
      />

      <BarraFerramentas
        direita={
          <span className="tabular text-[13px] text-muted-foreground">
            {fmtNum(lista.length)} contatos · {fmtNum(ativas.filter((p) => p.whatsapp).length)} com
            WhatsApp · {fmtNum(ativas.filter((p) => p.assinante).length)} assinantes
          </span>
        }
      >
        <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border bg-card px-3 sm:w-72 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(0);
            }}
            placeholder="Nome, e-mail, Instagram, empresa…"
            aria-label="Buscar pessoas"
            className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <Select
          value={filtro}
          onValueChange={(v) => {
            setFiltro(v);
            setPagina(0);
          }}
        >
          <SelectTrigger className="h-9 w-auto gap-2 bg-card text-[13px] font-medium">
            <UsersRound className="h-3.5 w-3.5 text-primary" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativas">Todos os contatos</SelectItem>
            <SelectItem value="todas">Incluir inativos</SelectItem>
            <SelectItem value="decisores">Decisores</SelectItem>
            <SelectItem value="whatsapp">Com WhatsApp</SelectItem>
            <SelectItem value="consentiram">Consentiram</SelectItem>
            <SelectItem value="assinantes">Assinantes da newsletter</SelectItem>
            <SelectItem value="aquecidos">Aquecidos (30 dias)</SelectItem>
            <SelectItem value="apareceram">Já apareceram em conteúdo</SelectItem>
            <SelectItem value="inativas">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </BarraFerramentas>

      {isLoading ? (
        <Carregando />
      ) : error ? (
        <Erro erro={error} />
      ) : lista.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-3 py-3">Contato</th>
                  <th className="px-3 py-3">Empresa e cargo</th>
                  <th className="px-3 py-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate({ to: "/pessoas/$id", params: { id: p.id } })}
                  >
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar nome={p.nome} className="h-8 w-8 text-[11px]" />
                        <Link
                          to="/pessoas/$id"
                          params={{ id: p.id }}
                          className="font-semibold hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.nome}
                        </Link>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12.5px]" onClick={(e) => e.stopPropagation()}>
                      {p.whatsapp ? (
                        <a
                          href={linkWhatsApp(p.whatsapp) ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 hover:text-primary"
                        >
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {p.whatsapp}
                        </a>
                      ) : null}
                      {p.email ? (
                        <a
                          href={`mailto:${p.email}`}
                          className="flex items-center gap-1.5 hover:text-primary"
                        >
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{p.email}</span>
                        </a>
                      ) : null}
                      {!p.whatsapp && !p.email ? (
                        <div className="flex flex-wrap gap-2">
                          <LinkExterno href={linkInstagram(p.instagram)}>Instagram</LinkExterno>
                          <LinkExterno href={linkLinkedIn(p.linkedin)}>LinkedIn</LinkExterno>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs">
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
                    <td className="px-3 py-3">
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
          <Paginacao
            pagina={pagina}
            total={lista.length}
            porPagina={POR_PAGINA}
            onMudar={setPagina}
          />
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
