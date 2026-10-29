import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Sparkles, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { EmpresaPicker, PessoaPicker } from "@/components/crm/pickers";
import { useAcao } from "@/components/crm/queries";
import {
  AvisoRepeticao,
  BotaoCsv,
  CabecalhoPagina,
  Campo,
  Carregando,
  Erro,
  Etiqueta,
  GrupoBadge,
  LinkExterno,
  Vazio,
} from "@/components/crm/ui";
import { NegocioPainel } from "@/components/crm/negocio";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getHoje } from "@/lib/crm/hoje.functions";
import { criarLeadDeEmpresa } from "@/lib/crm/negocios.functions";
import {
  desmarcarMencao,
  listPautas,
  marcarMencao,
  saveConteudo,
  sugerirMencoes,
  type ArtigoPauta,
  type ConteudoInput,
  type DadosPautas,
  type MencaoPauta,
  type Sugestao,
} from "@/lib/crm/pautas.functions";
import type { CrmCanalConteudo, CrmConteudo, CrmPapelMencao } from "@/lib/crm/types";
import {
  CANAIS_CONTEUDO,
  contem,
  deInputLocal,
  fmtDataHora,
  fmtDia,
  fmtDiaCurto,
  FORMATOS_CONTEUDO,
  labelDe,
  linkMateria,
  paraInputLocal,
} from "@/lib/crm/utils";

export const Route = createFileRoute("/_crm/pautas")({
  component: PautasPage,
});

type Alvo = { article_id?: string | null; conteudo_id?: string | null; titulo: string };

function PautasPage() {
  const fetchPautas = useServerFn(listPautas);
  const fetchHoje = useServerFn(getHoje);
  const criarLead = useServerFn(criarLeadDeEmpresa);
  const { executar } = useAcao();
  const [dias, setDias] = useState(60);
  const [q, setQ] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [conteudo, setConteudo] = useState<Partial<CrmConteudo> | null>(null);
  const [negocio, setNegocio] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "pautas", dias],
    queryFn: () => fetchPautas({ data: { dias } }),
  });
  const fila = useQuery({ queryKey: ["crm", "hoje"], queryFn: () => fetchHoje() });

  const porArtigo = useMemo(() => agrupar(data?.mencoes ?? [], "article_id"), [data]);
  const porConteudo = useMemo(() => agrupar(data?.mencoes ?? [], "conteudo_id"), [data]);
  const postsPorArtigo = useMemo(() => {
    const m = new Map<string, CrmConteudo[]>();
    for (const c of data?.conteudos ?? [])
      if (c.article_id) m.set(c.article_id, [...(m.get(c.article_id) ?? []), c]);
    return m;
  }, [data]);

  const agora = new Date().toISOString();
  const artigos = useMemo(
    () =>
      (data?.artigos ?? []).filter(
        (a) =>
          (!soPendentes || (a.published_at <= agora && !(porArtigo.get(a.id)?.length ?? 0))) &&
          contem([a.title, a.category, ...(a.tags ?? [])], q),
      ),
    [data, soPendentes, porArtigo, q, agora],
  );
  const pendentes = (data?.artigos ?? []).filter(
    (a) =>
      a.status === "published" && a.published_at <= agora && !(porArtigo.get(a.id)?.length ?? 0),
  ).length;

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Pautas e conteúdo"
        descricao="Toda matéria nova precisa das empresas e pessoas citadas marcadas. Empresa marcada sem negócio aberto entra na fila “Viraram pauta”."
        acoes={
          <>
            <BotaoCsv
              nome="pautas-mencoes"
              linhas={data?.mencoes ?? []}
              colunas={[
                {
                  titulo: "Matéria",
                  valor: (m) => data?.artigos.find((a) => a.id === m.article_id)?.title,
                },
                {
                  titulo: "Post",
                  valor: (m) => data?.conteudos.find((c) => c.id === m.conteudo_id)?.url,
                },
                { titulo: "Empresa", valor: (m) => m.empresa?.nome },
                { titulo: "Pessoa", valor: (m) => m.pessoa?.nome },
                { titulo: "Papel", valor: (m) => m.papel },
              ]}
            />
            <Button
              size="sm"
              className="h-9"
              onClick={() => setConteudo({ canal: "instagram", formato: "carrossel" })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Post nas redes
            </Button>
          </>
        }
      />

      {pendentes ? (
        <div className="rounded-[var(--radius)] border border-primary/40 bg-primary/5 p-3 text-sm">
          <strong>{pendentes}</strong> matéria(s) publicada(s) sem menções marcadas.{" "}
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => setSoPendentes(true)}
          >
            Ver pendentes
          </button>
        </div>
      ) : null}

      <Tabs defaultValue="materias">
        <TabsList className="h-10">
          <TabsTrigger value="materias">Matérias</TabsTrigger>
          <TabsTrigger value="posts">Posts nas redes</TabsTrigger>
          <TabsTrigger value="fila">
            Viraram pauta ({fila.data?.viraramPauta.length ?? "…"})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materias" className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[2fr_auto_160px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por título, categoria ou tag"
              className="h-10"
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={soPendentes} onCheckedChange={(v) => setSoPendentes(v === true)} />{" "}
              Só sem menções
            </label>
            <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="180">Últimos 6 meses</SelectItem>
                <SelectItem value="3650">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <Carregando />
          ) : error ? (
            <Erro erro={error} />
          ) : artigos.length ? (
            <ul className="space-y-2">
              {artigos.map((a) => (
                <LinhaArtigo
                  key={a.id}
                  a={a}
                  mencoes={porArtigo.get(a.id) ?? []}
                  posts={postsPorArtigo.get(a.id) ?? []}
                  aparicoes={data!.aparicoes}
                  onMarcar={() => setAlvo({ article_id: a.id, titulo: a.title })}
                  onPost={() =>
                    setConteudo({
                      article_id: a.id,
                      canal: "instagram",
                      formato: "carrossel",
                      titulo: a.title,
                    })
                  }
                />
              ))}
            </ul>
          ) : (
            <Vazio>Nenhuma matéria no período.</Vazio>
          )}
        </TabsContent>

        <TabsContent value="posts" className="mt-4">
          {data?.conteudos.length ? (
            <div className="overflow-x-auto rounded-[var(--radius)] border bg-card">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Post</th>
                    <th className="px-3 py-2">Canal</th>
                    <th className="px-3 py-2">Publicado</th>
                    <th className="px-3 py-2">Collab</th>
                    <th className="px-3 py-2">Menções</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.conteudos.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2">
                        <LinkExterno href={c.url}>{c.titulo ?? c.url ?? "post"}</LinkExterno>
                        {c.article_id ? (
                          <p className="text-xs text-muted-foreground">
                            matéria: {data.artigos.find((a) => a.id === c.article_id)?.title ?? "—"}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {labelDe(CANAIS_CONTEUDO, c.canal)} · {c.formato ?? "—"}
                      </td>
                      <td className="px-3 py-2">{fmtDataHora(c.publicado_em)}</td>
                      <td className="px-3 py-2">
                        {c.collab_aceito === true ? (
                          <Etiqueta tom="ok">aceito</Etiqueta>
                        ) : c.collab_aceito === false ? (
                          <Etiqueta>recusado</Etiqueta>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Chips mencoes={porConteudo.get(c.id) ?? []} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() =>
                              setAlvo({ conteudo_id: c.id, titulo: c.titulo ?? c.url ?? "post" })
                            }
                          >
                            <Tag className="mr-1 h-4 w-4" /> Marcar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => setConteudo(c)}
                          >
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vazio>
              Nenhum post registrado. Cadastre o link de cada post nas redes e se o collab foi
              aceito.
            </Vazio>
          )}
        </TabsContent>

        <TabsContent value="fila" className="mt-4">
          {fila.isLoading ? (
            <Carregando />
          ) : fila.data?.viraramPauta.length ? (
            <ul className="divide-y rounded-[var(--radius)] border bg-card">
              {fila.data.viraramPauta.map((f) => (
                <li
                  key={f.empresa_id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/empresas/$id"
                        params={{ id: f.empresa_id }}
                        className="font-semibold hover:text-primary"
                      >
                        {f.nome}
                      </Link>
                      <GrupoBadge grupo={f.grupo} pontuacao={f.pontuacao} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {f.article_title ?? "post"} · {fmtDiaCurto(f.ultima_mencao_em)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const r = await executar(
                        () =>
                          criarLead({
                            data: { empresa_id: f.empresa_id, article_id: f.article_id },
                          }),
                        "Lead criado com o link da matéria.",
                      );
                      if (r) setNegocio(r.id);
                    }}
                  >
                    Criar lead
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Fila vazia.</Vazio>
          )}
        </TabsContent>
      </Tabs>

      {alvo && data ? (
        <MencoesDialog alvo={alvo} dados={data} onClose={() => setAlvo(null)} />
      ) : null}
      <ConteudoDialog
        conteudo={conteudo}
        artigos={data?.artigos ?? []}
        onClose={() => setConteudo(null)}
      />
      <NegocioPainel id={negocio} onClose={() => setNegocio(null)} />
    </div>
  );
}

function agrupar(lista: MencaoPauta[], chave: "article_id" | "conteudo_id") {
  const m = new Map<string, MencaoPauta[]>();
  for (const x of lista) {
    const k = x[chave];
    if (k) m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}

function Chips({
  mencoes,
  onRemover,
}: {
  mencoes: MencaoPauta[];
  onRemover?: (id: string) => void;
}) {
  if (!mencoes.length) return <span className="text-xs text-muted-foreground">nenhuma</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {mencoes.map((m) => (
        <span
          key={m.id}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
        >
          {m.empresa ? (
            <Link to="/empresas/$id" params={{ id: m.empresa.id }} className="hover:underline">
              {m.empresa.nome}
            </Link>
          ) : null}
          {m.empresa && m.pessoa ? " · " : ""}
          {m.pessoa ? (
            <Link
              to="/pessoas/$id"
              params={{ id: m.pessoa.id }}
              className="font-normal hover:underline"
            >
              {m.pessoa.nome}
            </Link>
          ) : null}
          {onRemover ? (
            <button
              type="button"
              aria-label="Desmarcar"
              onClick={() => onRemover(m.id)}
              className="ml-0.5 opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function LinhaArtigo({
  a,
  mencoes,
  posts,
  aparicoes,
  onMarcar,
  onPost,
}: {
  a: ArtigoPauta;
  mencoes: MencaoPauta[];
  posts: CrmConteudo[];
  aparicoes: DadosPautas["aparicoes"];
  onMarcar: () => void;
  onPost: () => void;
}) {
  const agendada = a.published_at > new Date().toISOString();
  const repetidas = mencoes.filter(
    (m) =>
      (m.empresa_id && (aparicoes.empresas[m.empresa_id] ?? 0) > 1) ||
      (m.pessoa_id && (aparicoes.pessoas[m.pessoa_id] ?? 0) > 1),
  );
  return (
    <li className="rounded-[var(--radius)] border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <a
            href={linkMateria(a.slug)!}
            target="_blank"
            rel="noreferrer"
            className="font-semibold hover:text-primary"
          >
            {a.title}
          </a>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {a.category} · {fmtDia(a.published_at)}
            {agendada ? " · agendada" : ""}
            {a.status === "draft" ? " · rascunho" : ""}
            {a.origin ? ` · origem ${a.origin}` : ""}
            {posts.length ? ` · ${posts.length} post(s)` : ""}
          </p>
          <div className="mt-2">
            <Chips mencoes={mencoes} />
          </div>
          {repetidas.length ? (
            <p className="mt-1 text-[11px] text-destructive">
              Atenção: {repetidas.length} citado(s) já apareceram em outro conteúdo (regra de não
              repetir).
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant={mencoes.length ? "outline" : "default"}
            className="h-8"
            onClick={onMarcar}
          >
            <Tag className="mr-1 h-4 w-4" /> Marcar menções
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={onPost}
            title="Registrar post desta matéria nas redes"
          >
            <Plus className="mr-1 h-4 w-4" /> Post
          </Button>
        </div>
      </div>
    </li>
  );
}

function MencoesDialog({
  alvo,
  dados,
  onClose,
}: {
  alvo: Alvo;
  dados: DadosPautas;
  onClose: () => void;
}) {
  const marcar = useServerFn(marcarMencao);
  const desmarcar = useServerFn(desmarcarMencao);
  const sugerir = useServerFn(sugerirMencoes);
  const { executar, ocupado } = useAcao();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNova, setEmpresaNova] = useState<string | null>(null);
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [pessoaNova, setPessoaNova] = useState<string | null>(null);
  const [cargo, setCargo] = useState("");
  const [papel, setPapel] = useState<CrmPapelMencao>("citada");
  const [brasileira, setBrasileira] = useState(true);
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null);
  const [sugerindo, setSugerindo] = useState(false);

  const atuais = dados.mencoes.filter((m) =>
    alvo.article_id ? m.article_id === alvo.article_id : m.conteudo_id === alvo.conteudo_id,
  );

  useEffect(() => {
    setSugestoes(null);
  }, [alvo.article_id, alvo.conteudo_id]);

  const limpar = () => {
    setEmpresaId(null);
    setEmpresaNova(null);
    setPessoaId(null);
    setPessoaNova(null);
    setCargo("");
    setPapel("citada");
    setBrasileira(true);
  };

  async function salvar(extra?: Partial<Parameters<typeof marcar>[0]["data"]>) {
    const r = await executar(() =>
      marcar({
        data: {
          article_id: alvo.article_id,
          conteudo_id: alvo.conteudo_id,
          empresa_id: empresaId,
          empresa_nome: empresaNova,
          empresa_brasileira: brasileira,
          pessoa_id: pessoaId,
          pessoa_nome: pessoaNova,
          cargo,
          papel,
          ...extra,
        },
      }),
    );
    if (r) {
      const rep = [
        r.repeticao.empresa ? `empresa já apareceu ${r.repeticao.empresa}x` : null,
        r.repeticao.pessoa ? `pessoa já apareceu ${r.repeticao.pessoa}x` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (rep) toast.warning(`Menção marcada. Atenção: ${rep}.`);
      else toast.success("Menção marcada.");
      limpar();
    }
    return r;
  }

  async function pedirSugestoes() {
    if (!alvo.article_id) return;
    setSugerindo(true);
    try {
      const r = await sugerir({ data: { article_id: alvo.article_id } });
      setSugestoes(r.sugestoes);
      if (!r.sugestoes.length) toast.info("Nenhuma sugestão nova encontrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível sugerir.");
    } finally {
      setSugerindo(false);
    }
  }

  async function aceitarSugestao(s: Sugestao) {
    const r =
      s.tipo === "empresa"
        ? await salvar({
            empresa_id: s.id,
            empresa_nome: s.id ? null : s.nome,
            empresa_brasileira: s.brasileira !== false,
            pessoa_id: null,
            pessoa_nome: null,
            cargo: null,
          })
        : await salvar({
            pessoa_id: s.id,
            pessoa_nome: s.id ? null : s.nome,
            empresa_id: null,
            empresa_nome: s.empresa ?? null,
            cargo: s.cargo ?? null,
          });
    if (r) setSugestoes((lista) => lista?.filter((x) => x !== s) ?? null);
  }

  const repEmpresa = empresaId ? (dados.aparicoes.empresas[empresaId] ?? 0) : 0;
  const repPessoa = pessoaId ? (dados.aparicoes.pessoas[pessoaId] ?? 0) : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Menções</DialogTitle>
          <DialogDescription className="line-clamp-2">{alvo.titulo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold">Marcadas</p>
            <Chips
              mencoes={atuais}
              onRemover={(id) => executar(() => desmarcar({ data: { id } }), "Menção desmarcada.")}
            />
          </div>

          {alvo.article_id ? (
            <div className="rounded-lg border border-dashed p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Sugestão automática</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={pedirSugestoes}
                  disabled={sugerindo}
                >
                  {sugerindo ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" />
                  )}{" "}
                  Sugerir pelo título, texto e tags
                </Button>
              </div>
              {sugestoes?.length ? (
                <ul className="mt-2 space-y-1.5">
                  {sugestoes.map((s) => {
                    const vezes = s.id
                      ? ((s.tipo === "empresa"
                          ? dados.aparicoes.empresas[s.id]
                          : dados.aparicoes.pessoas[s.id]) ?? 0)
                      : 0;
                    return (
                      <li
                        key={`${s.tipo}-${s.nome}`}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Etiqueta>{s.tipo}</Etiqueta>
                          <strong>{s.nome}</strong>
                          {s.empresa && s.tipo === "pessoa" ? (
                            <span className="text-xs text-muted-foreground">({s.empresa})</span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            · {s.id ? "já cadastrada" : "nova"} · {s.motivo}
                          </span>
                          <AvisoRepeticao vezes={vezes} />
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          disabled={ocupado}
                          onClick={() => aceitarSugestao(s)}
                        >
                          Marcar
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <p className="text-sm font-semibold sm:col-span-2">Marcar à mão</p>
            <Campo rotulo="Empresa" dica={empresaNova ? `Nova empresa: ${empresaNova}` : undefined}>
              <EmpresaPicker
                valor={empresaId}
                onChange={(v) => {
                  setEmpresaId(v);
                  setEmpresaNova(null);
                }}
                criar={(nome) => {
                  setEmpresaId(null);
                  setEmpresaNova(nome);
                }}
              />
              <AvisoRepeticao vezes={repEmpresa} />
            </Campo>
            <Campo rotulo="Pessoa" dica={pessoaNova ? `Nova pessoa: ${pessoaNova}` : undefined}>
              <PessoaPicker
                valor={pessoaId}
                empresaId={empresaId}
                onChange={(v) => {
                  setPessoaId(v);
                  setPessoaNova(null);
                }}
                criar={(nome) => {
                  setPessoaId(null);
                  setPessoaNova(nome);
                }}
              />
              <AvisoRepeticao vezes={repPessoa} />
            </Campo>
            <Campo rotulo="Cargo da pessoa">
              <Input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="CEO e fundador"
              />
            </Campo>
            <Campo rotulo="Papel no conteúdo">
              <Select value={papel} onValueChange={(v) => setPapel(v as CrmPapelMencao)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="protagonista">Protagonista</SelectItem>
                  <SelectItem value="citada">Citada</SelectItem>
                  <SelectItem value="colaboradora">Colaboradora (collab)</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            {empresaNova ? (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox checked={brasileira} onCheckedChange={(v) => setBrasileira(v === true)} />{" "}
                Empresa brasileira ou com operação no Brasil
              </label>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            disabled={ocupado || (!empresaId && !empresaNova && !pessoaId && !pessoaNova)}
            onClick={() => salvar()}
          >
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Marcar menção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoDialog({
  conteudo,
  artigos,
  onClose,
}: {
  conteudo: Partial<CrmConteudo> | null;
  artigos: ArtigoPauta[];
  onClose: () => void;
}) {
  const salvar = useServerFn(saveConteudo);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<ConteudoInput>({ canal: "instagram" });

  useEffect(() => {
    if (!conteudo) return;
    setF({
      id: conteudo.id,
      article_id: conteudo.article_id ?? null,
      canal: (conteudo.canal ?? "instagram") as CrmCanalConteudo,
      formato: conteudo.formato ?? "post",
      titulo: conteudo.titulo ?? "",
      url: conteudo.url ?? "",
      publicado_em: paraInputLocal(conteudo.publicado_em),
      collab_aceito: conteudo.collab_aceito ?? null,
      ativo: conteudo.ativo ?? true,
    });
  }, [conteudo]);

  const set = <K extends keyof ConteudoInput>(k: K, v: ConteudoInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));

  return (
    <Dialog open={!!conteudo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar post" : "Post nas redes"}</DialogTitle>
          <DialogDescription>
            Registre o link de cada post e se o collab foi aceito. Depois marque as menções.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Matéria do site" className="sm:col-span-2">
            <Select
              value={f.article_id ?? "nenhuma"}
              onValueChange={(v) => set("article_id", v === "nenhuma" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem matéria</SelectItem>
                {artigos.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title.slice(0, 90)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Canal">
            <Select value={f.canal} onValueChange={(v) => set("canal", v as CrmCanalConteudo)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANAIS_CONTEUDO.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Formato" dica="Reels só no Instagram e no Facebook.">
            <Select value={f.formato ?? "post"} onValueChange={(v) => set("formato", v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATOS_CONTEUDO.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Link do post" className="sm:col-span-2">
            <Input
              value={f.url ?? ""}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://www.instagram.com/p/..."
            />
          </Campo>
          <Campo rotulo="Título / legenda curta" className="sm:col-span-2">
            <Input value={f.titulo ?? ""} onChange={(e) => set("titulo", e.target.value)} />
          </Campo>
          <Campo rotulo="Publicado em">
            <Input
              type="datetime-local"
              value={f.publicado_em ?? ""}
              onChange={(e) => set("publicado_em", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Collab">
            <Select
              value={f.collab_aceito == null ? "sem" : f.collab_aceito ? "sim" : "nao"}
              onValueChange={(v) => set("collab_aceito", v === "sem" ? null : v === "sim")}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem">Sem resposta / sem collab</SelectItem>
                <SelectItem value="sim">Aceito</SelectItem>
                <SelectItem value="nao">Recusado</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado}
            onClick={async () => {
              const r = await executar(
                () => salvar({ data: { ...f, publicado_em: deInputLocal(f.publicado_em) } }),
                "Post salvo.",
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
