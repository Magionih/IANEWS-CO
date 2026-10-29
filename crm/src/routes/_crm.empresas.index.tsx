import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { EmpresaDialog } from "@/components/crm/dialogs";
import { MembroSelect } from "@/components/crm/pickers";
import { useEmpresas } from "@/components/crm/queries";
import {
  BotaoCsv,
  CabecalhoPagina,
  Carregando,
  Erro,
  Etiqueta,
  GrupoBadge,
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
import { contem, fmtNum, labelDe, ORIGENS, PORTES } from "@/lib/crm/utils";

export const Route = createFileRoute("/_crm/empresas/")({
  component: EmpresasPage,
});

function EmpresasPage() {
  const { membro } = useCrm();
  const navigate = useNavigate();
  const { data, isLoading, error } = useEmpresas();
  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState("todos");
  const [status, setStatus] = useState("ativas");
  const [dono, setDono] = useState<string | null>(null);
  const [nova, setNova] = useState(false);

  const lista = useMemo(
    () =>
      (data ?? []).filter(
        (e) =>
          (grupo === "todos" || e.grupo === grupo) &&
          (!dono || e.dono_id === dono) &&
          (status === "todas" ||
            (status === "ativas" && e.ativo) ||
            (status === "inativas" && !e.ativo) ||
            (status === "clientes" && e.e_cliente) ||
            (status === "anunciantes" && e.e_anunciante) ||
            (status === "apareceram" && e.mencoes > 0) ||
            (status === "sem_negocio" && e.ativo && e.negocios_abertos === 0)) &&
          contem([e.nome, e.instagram, e.site, e.setor, e.cidade], q),
      ),
    [data, q, grupo, status, dono],
  );

  const ativas = (data ?? []).filter((e) => e.ativo);
  const conta = (g: string) => ativas.filter((e) => e.grupo === g).length;

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Empresas"
        descricao="Cadastro único de empresas. Pontuação de 0 a 100 e grupo A/B/C calculados pelo sistema a cada mudança."
        acoes={
          <>
            <BotaoCsv
              nome="empresas"
              linhas={lista}
              colunas={[
                { titulo: "Nome", valor: (e) => e.nome },
                { titulo: "Pontuação", valor: (e) => e.pontuacao },
                { titulo: "Grupo", valor: (e) => e.grupo },
                { titulo: "Grupo manual", valor: (e) => e.grupo_manual },
                { titulo: "Site", valor: (e) => e.site },
                { titulo: "Instagram", valor: (e) => e.instagram },
                { titulo: "LinkedIn", valor: (e) => e.linkedin },
                { titulo: "Setor", valor: (e) => e.setor },
                { titulo: "Cidade", valor: (e) => e.cidade },
                { titulo: "País", valor: (e) => e.pais },
                { titulo: "Brasileira", valor: (e) => e.brasileira },
                { titulo: "Porte", valor: (e) => labelDe(PORTES, e.porte) },
                { titulo: "Seguidores", valor: (e) => e.seguidores_instagram },
                { titulo: "Cliente", valor: (e) => e.e_cliente },
                { titulo: "Anunciante", valor: (e) => e.e_anunciante },
                { titulo: "Origem", valor: (e) => labelDe(ORIGENS, e.origem) },
                { titulo: "Dono", valor: (e) => membro(e.dono_id) },
                { titulo: "Pessoas", valor: (e) => e.pessoas },
                { titulo: "Menções", valor: (e) => e.mencoes },
                { titulo: "Negócios abertos", valor: (e) => e.negocios_abertos },
                { titulo: "Cadastrada em", valor: (e) => e.created_at },
              ]}
            />
            <Button size="sm" className="h-9" onClick={() => setNova(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova empresa
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Numero rotulo="Empresas ativas" valor={fmtNum(ativas.length)} />
        <Numero rotulo="Grupo A" valor={fmtNum(conta("A"))} destaque="azul" />
        <Numero rotulo="Grupo B" valor={fmtNum(conta("B"))} />
        <Numero rotulo="Grupo C" valor={fmtNum(conta("C"))} />
        <Numero rotulo="Clientes" valor={fmtNum(ativas.filter((e) => e.e_cliente).length)} />
      </section>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por nome, Instagram, site, setor ou cidade"
          className="h-10"
        />
        <Select value={grupo} onValueChange={setGrupo}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os grupos</SelectItem>
            <SelectItem value="A">Grupo A (70+)</SelectItem>
            <SelectItem value="B">Grupo B (40 a 69)</SelectItem>
            <SelectItem value="C">Grupo C (até 39)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="clientes">Clientes</SelectItem>
            <SelectItem value="anunciantes">Anunciantes</SelectItem>
            <SelectItem value="apareceram">Já apareceram em conteúdo</SelectItem>
            <SelectItem value="sem_negocio">Sem negócio aberto</SelectItem>
            <SelectItem value="inativas">Inativas</SelectItem>
          </SelectContent>
        </Select>
        <MembroSelect valor={dono} onChange={setDono} incluirTodos placeholder="Dono" />
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
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Grupo</th>
                <th className="px-3 py-2">Setor / porte</th>
                <th className="px-3 py-2 text-right">Pessoas</th>
                <th className="px-3 py-2 text-right">Menções</th>
                <th className="px-3 py-2 text-right">Negócios</th>
                <th className="px-3 py-2">Dono</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate({ to: "/empresas/$id", params: { id: e.id } })}
                >
                  <td className="px-3 py-2">
                    <Link
                      to="/empresas/$id"
                      params={{ id: e.id }}
                      className="font-semibold hover:text-primary"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {e.nome}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {e.e_cliente ? <Etiqueta tom="ok">cliente</Etiqueta> : null}
                      {e.e_anunciante ? <Etiqueta tom="azul">anunciante</Etiqueta> : null}
                      {e.brasileira === false ? <Etiqueta>estrangeira</Etiqueta> : null}
                      {!e.ativo ? <Etiqueta tom="alerta">inativa</Etiqueta> : null}
                      {e.instagram ? (
                        <span className="text-xs text-muted-foreground">@{e.instagram}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <GrupoBadge grupo={e.grupo} manual={e.grupo_manual} pontuacao={e.pontuacao} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[e.setor, labelDe(PORTES, e.porte) !== "—" ? labelDe(PORTES, e.porte) : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-right">{e.pessoas}</td>
                  <td className="px-3 py-2 text-right">{e.mencoes}</td>
                  <td className="px-3 py-2 text-right">{e.negocios_abertos}</td>
                  <td className="px-3 py-2">{membro(e.dono_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Vazio>Nenhuma empresa com esses filtros.</Vazio>
      )}

      <EmpresaDialog
        aberto={nova}
        onClose={() => setNova(false)}
        onSalva={(id) => navigate({ to: "/empresas/$id", params: { id } })}
      />
    </div>
  );
}
