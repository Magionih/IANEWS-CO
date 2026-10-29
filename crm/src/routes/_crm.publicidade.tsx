import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileCheck2, Loader2, Plus } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { NegocioDialog, NegocioPainel } from "@/components/crm/negocio";
import { useAcao } from "@/components/crm/queries";
import {
  BotaoCsv,
  CabecalhoPagina,
  Campo,
  Carregando,
  Erro,
  Etiqueta,
  GrupoBadge,
  LinkExterno,
  Numero,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getPublicidade,
  saveCampanha,
  saveEntrega,
  type CampanhaInput,
  type EntregaInput,
} from "@/lib/crm/publicidade.functions";
import type { CrmCampanha, CrmEntrega } from "@/lib/crm/types";
import {
  CAMPANHA_LABEL,
  CANAIS_CONTEUDO,
  deInputLocal,
  fmtDataHora,
  fmtDia,
  fmtMoeda,
  fmtNum,
  FORMATOS_ENTREGA,
  labelDe,
  paraInputLocal,
} from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/publicidade")({
  component: PublicidadePage,
});

function PublicidadePage() {
  const { membro } = useCrm();
  const fetchPub = useServerFn(getPublicidade);
  const salvarEntrega = useServerFn(saveEntrega);
  const { executar } = useAcao();
  const [campanha, setCampanha] = useState<Partial<CrmCampanha> | null>(null);
  const [entrega, setEntrega] = useState<Partial<CrmEntrega> | null>(null);
  const [relatorio, setRelatorio] = useState<CrmCampanha | null>(null);
  const [negocio, setNegocio] = useState<string | null>(null);
  const [novoNegocio, setNovoNegocio] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "publicidade"],
    queryFn: () => fetchPub(),
  });

  const negocioPorId = useMemo(() => new Map((data?.negocios ?? []).map((n) => [n.id, n])), [data]);
  const entregasPor = useMemo(() => {
    const m = new Map<string, CrmEntrega[]>();
    for (const e of data?.entregas ?? [])
      m.set(e.campanha_id, [...(m.get(e.campanha_id) ?? []), e]);
    return m;
  }, [data]);

  if (isLoading) return <Carregando />;
  if (error || !data) return <Erro erro={error} />;

  const agora = Date.now();
  const pendentes = data.entregas
    .filter((e) => !e.entregue)
    .sort((a, b) => (a.agendado_para ?? "9").localeCompare(b.agendado_para ?? "9"));
  const atrasadas = pendentes.filter(
    (e) => e.agendado_para && new Date(e.agendado_para).getTime() < agora,
  );
  const ativas = data.campanhas.filter(
    (c) => c.status === "planejada" || c.status === "em_veiculacao",
  );
  const nomeCampanha = (id: string) => data.campanhas.find((c) => c.id === id)?.nome ?? "—";

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Publicidade"
        descricao="Anunciantes, campanhas vendidas, peças a entregar e relatório. Ao anexar o relatório, a campanha é concluída e a renovação vira tarefa em 30 dias."
        acoes={
          <>
            <BotaoCsv
              nome="entregas-publicidade"
              linhas={data.entregas}
              colunas={[
                { titulo: "Campanha", valor: (e) => nomeCampanha(e.campanha_id) },
                { titulo: "Formato", valor: (e) => e.formato },
                { titulo: "Canal", valor: (e) => e.canal },
                { titulo: "Título", valor: (e) => e.titulo },
                { titulo: "Agendado para", valor: (e) => e.agendado_para },
                { titulo: "Entregue", valor: (e) => e.entregue },
                { titulo: "Entregue em", valor: (e) => e.entregue_em },
                { titulo: "Link", valor: (e) => e.url },
              ]}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => setNovoNegocio(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Anunciante / negócio
            </Button>
            <Button size="sm" className="h-9" onClick={() => setCampanha({ status: "planejada" })}>
              <Plus className="mr-1.5 h-4 w-4" /> Campanha
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Campanhas ativas" valor={fmtNum(ativas.length)} destaque="azul" />
        <Numero rotulo="Peças a entregar" valor={fmtNum(pendentes.length)} />
        <Numero
          rotulo="Peças atrasadas"
          valor={fmtNum(atrasadas.length)}
          destaque={atrasadas.length ? "alerta" : undefined}
        />
        <Numero
          rotulo="Negócios abertos"
          valor={fmtNum(data.negocios.filter((n) => n.etapa_tipo === "aberta").length)}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Secao titulo="Campanhas" contagem={data.campanhas.length}>
          {data.campanhas.length ? (
            <ul className="space-y-3">
              {data.campanhas.map((c) => {
                const entregas = (entregasPor.get(c.id) ?? []).sort((a, b) =>
                  (a.agendado_para ?? "9").localeCompare(b.agendado_para ?? "9"),
                );
                const feitas = entregas.filter((e) => e.entregue).length;
                const n = c.negocio_id ? negocioPorId.get(c.negocio_id) : undefined;
                return (
                  <li key={c.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="text-left font-semibold hover:text-primary"
                          onClick={() => setCampanha(c)}
                        >
                          {c.nome}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {n ? (
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => setNegocio(n.id)}
                            >
                              {n.empresa_nome ?? n.titulo}
                            </button>
                          ) : (
                            "sem negócio"
                          )}
                          {n?.valor ? ` · ${fmtMoeda(n.valor)}` : ""} · {fmtDia(c.inicio)} a{" "}
                          {fmtDia(c.fim)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Etiqueta
                          tom={
                            c.status === "concluida"
                              ? "ok"
                              : c.status === "em_veiculacao"
                                ? "azul"
                                : "neutro"
                          }
                        >
                          {CAMPANHA_LABEL[c.status]}
                        </Etiqueta>
                        <Etiqueta>
                          {feitas}/{entregas.length} peças
                        </Etiqueta>
                      </div>
                    </div>
                    {entregas.length ? (
                      <ul className="mt-2 space-y-1">
                        {entregas.map((e) => (
                          <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <Checkbox
                              checked={e.entregue}
                              onCheckedChange={(v) =>
                                executar(
                                  () => salvarEntrega({ data: { id: e.id, entregue: v === true } }),
                                  v === true ? "Peça marcada como entregue." : "Peça reaberta.",
                                )
                              }
                              aria-label="Entregue"
                            />
                            <button
                              type="button"
                              className={cn(
                                "text-left hover:text-primary",
                                e.entregue && "text-muted-foreground line-through",
                              )}
                              onClick={() => setEntrega(e)}
                            >
                              {e.formato ?? "peça"} · {e.canal ?? "—"}
                              {e.titulo ? ` · ${e.titulo}` : ""}
                            </button>
                            <span
                              className={cn(
                                "text-xs text-muted-foreground",
                                !e.entregue &&
                                  e.agendado_para &&
                                  new Date(e.agendado_para).getTime() < agora &&
                                  "font-semibold text-destructive",
                              )}
                            >
                              {fmtDataHora(e.agendado_para)}
                            </span>
                            <LinkExterno href={e.url}>link</LinkExterno>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Nenhuma peça cadastrada.</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() =>
                          setEntrega({ campanha_id: c.id, formato: "post", canal: "instagram" })
                        }
                      >
                        <Plus className="mr-1 h-4 w-4" /> Peça
                      </Button>
                      {c.relatorio_url ? (
                        <span className="flex items-center gap-1 text-xs">
                          <FileCheck2 className="h-4 w-4 text-primary" />
                          <LinkExterno href={c.relatorio_url}>Relatório</LinkExterno>
                          <span className="text-muted-foreground">
                            enviado em {fmtDia(c.relatorio_enviado_em)}
                          </span>
                        </span>
                      ) : (
                        <Button size="sm" className="h-8" onClick={() => setRelatorio(c)}>
                          <FileCheck2 className="mr-1 h-4 w-4" /> Anexar relatório
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vazio>Nenhuma campanha. Crie a campanha a partir do negócio fechado.</Vazio>
          )}
        </Secao>

        <div className="space-y-5">
          <Secao titulo="Entregas por data" contagem={pendentes.length}>
            {pendentes.length ? (
              <ul className="divide-y">
                {pendentes.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 py-2 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      checked={false}
                      onCheckedChange={() =>
                        executar(
                          () => salvarEntrega({ data: { id: e.id, entregue: true } }),
                          "Peça marcada como entregue.",
                        )
                      }
                      aria-label="Marcar entregue"
                    />
                    <span className="min-w-0">
                      <span className="font-medium">
                        {e.formato ?? "peça"} · {nomeCampanha(e.campanha_id)}
                      </span>
                      <span
                        className={cn(
                          "block text-xs text-muted-foreground",
                          e.agendado_para &&
                            new Date(e.agendado_para).getTime() < agora &&
                            "font-semibold text-destructive",
                        )}
                      >
                        {e.agendado_para ? fmtDataHora(e.agendado_para) : "sem data"} ·{" "}
                        {e.canal ?? "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhuma peça pendente.</Vazio>
            )}
          </Secao>

          <Secao titulo="Anunciantes" contagem={data.anunciantes.length}>
            {data.anunciantes.length ? (
              <ul className="space-y-1.5 text-sm">
                {data.anunciantes.map((a) => {
                  const negs = data.negocios.filter((n) => n.empresa_id === a.id);
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <Link
                        to="/empresas/$id"
                        params={{ id: a.id }}
                        className="font-medium hover:text-primary"
                      >
                        {a.nome}
                      </Link>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {negs[0]
                          ? `${negs[0].etapa_nome} · ${membro(negs[0].dono_id)}`
                          : a.e_anunciante
                            ? "anunciante"
                            : ""}
                        <GrupoBadge grupo={a.grupo} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Vazio>Nenhum anunciante ainda.</Vazio>
            )}
          </Secao>
        </div>
      </div>

      <CampanhaDialog
        campanha={campanha}
        negocios={data.negocios}
        onClose={() => setCampanha(null)}
      />
      <EntregaDialog entrega={entrega} onClose={() => setEntrega(null)} />
      <RelatorioDialog campanha={relatorio} onClose={() => setRelatorio(null)} />
      <NegocioPainel id={negocio} onClose={() => setNegocio(null)} />
      <NegocioDialog
        aberto={novoNegocio}
        onClose={() => setNovoNegocio(false)}
        inicial={{ funil_id: "publicidade", tipo: "pacote_publicidade" }}
        onSalvo={setNegocio}
      />
    </div>
  );
}

function CampanhaDialog({
  campanha,
  negocios,
  onClose,
}: {
  campanha: Partial<CrmCampanha> | null;
  negocios: { id: string; titulo: string; empresa_nome: string | null; etapa_nome: string }[];
  onClose: () => void;
}) {
  const salvar = useServerFn(saveCampanha);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<CampanhaInput>({});
  useEffect(() => {
    if (campanha)
      setF({
        id: campanha.id,
        nome: campanha.nome ?? "",
        negocio_id: campanha.negocio_id ?? null,
        inicio: campanha.inicio ?? "",
        fim: campanha.fim ?? "",
        status: campanha.status ?? "planejada",
        notas: campanha.notas ?? "",
      });
  }, [campanha]);
  const set = <K extends keyof CampanhaInput>(k: K, v: CampanhaInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={!!campanha} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          <DialogDescription>
            Ligue a campanha ao negócio de publicidade para levar empresa, valor e dono.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome *" className="sm:col-span-2">
            <Input
              value={f.nome ?? ""}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Pacote de entrada · Marca"
            />
          </Campo>
          <Campo rotulo="Negócio" className="sm:col-span-2">
            <Select
              value={f.negocio_id ?? "nenhum"}
              onValueChange={(v) => set("negocio_id", v === "nenhum" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem negócio</SelectItem>
                {negocios.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.empresa_nome ?? n.titulo} · {n.etapa_nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Início">
            <Input
              type="date"
              value={f.inicio ?? ""}
              onChange={(e) => set("inicio", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Fim">
            <Input type="date" value={f.fim ?? ""} onChange={(e) => set("fim", e.target.value)} />
          </Campo>
          <Campo rotulo="Status">
            <Select
              value={f.status ?? "planejada"}
              onValueChange={(v) => set("status", v as CrmCampanha["status"])}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CAMPANHA_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Notas" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={f.notas ?? ""}
              onChange={(e) => set("notas", e.target.value)}
            />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado || !f.nome?.trim()}
            onClick={async () => {
              const r = await executar(() => salvar({ data: f }), "Campanha salva.");
              if (r) onClose();
            }}
          >
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntregaDialog({
  entrega,
  onClose,
}: {
  entrega: Partial<CrmEntrega> | null;
  onClose: () => void;
}) {
  const salvar = useServerFn(saveEntrega);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<EntregaInput>({});
  useEffect(() => {
    if (entrega)
      setF({
        id: entrega.id,
        campanha_id: entrega.campanha_id,
        formato: entrega.formato ?? "post",
        canal: entrega.canal ?? "instagram",
        titulo: entrega.titulo ?? "",
        agendado_para: paraInputLocal(entrega.agendado_para),
        url: entrega.url ?? "",
        entregue: entrega.entregue ?? false,
      });
  }, [entrega]);
  const set = <K extends keyof EntregaInput>(k: K, v: EntregaInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={!!entrega} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar peça" : "Nova peça"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Formato">
            <Select value={f.formato ?? "post"} onValueChange={(v) => set("formato", v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATOS_ENTREGA.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Canal">
            <Select value={f.canal ?? "instagram"} onValueChange={(v) => set("canal", v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANAIS_CONTEUDO.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {labelDe(CANAIS_CONTEUDO, c.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Título" className="sm:col-span-2">
            <Input value={f.titulo ?? ""} onChange={(e) => set("titulo", e.target.value)} />
          </Campo>
          <Campo rotulo="Agendado para">
            <Input
              type="datetime-local"
              value={f.agendado_para ?? ""}
              onChange={(e) => set("agendado_para", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Link publicado">
            <Input
              value={f.url ?? ""}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://..."
            />
          </Campo>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={!!f.entregue} onCheckedChange={(v) => set("entregue", v === true)} />{" "}
            Entregue
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado}
            onClick={async () => {
              const r = await executar(
                () => salvar({ data: { ...f, agendado_para: deInputLocal(f.agendado_para) } }),
                "Peça salva.",
              );
              if (r) onClose();
            }}
          >
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RelatorioDialog({
  campanha,
  onClose,
}: {
  campanha: CrmCampanha | null;
  onClose: () => void;
}) {
  const salvar = useServerFn(saveCampanha);
  const { executar, ocupado } = useAcao();
  const [link, setLink] = useState("");
  useEffect(() => {
    if (campanha) setLink("");
  }, [campanha]);
  return (
    <Dialog open={!!campanha} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório de entrega</DialogTitle>
          <DialogDescription>
            Cole o link do relatório (Drive, PDF). A campanha fica concluída, o negócio vai para
            “Relatório entregue” e a renovação vira tarefa em 30 dias.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://drive.google.com/..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado || !link.trim() || !campanha}
            onClick={async () => {
              const r = await executar(
                () => salvar({ data: { id: campanha!.id, relatorio_url: link } }),
                "Relatório anexado. Renovação agendada para 30 dias.",
              );
              if (r) onClose();
            }}
          >
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Anexar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
