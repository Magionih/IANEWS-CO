import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Save } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { useAcao, useModelos } from "@/components/crm/queries";
import {
  CabecalhoPagina,
  Campo,
  Carregando,
  Erro,
  Etiqueta,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  listUsuarios,
  saveEtapa,
  saveModelo,
  setPapel,
  type EtapaInput,
  type ModeloInput,
  type PapelEquipe,
} from "@/lib/crm/config.functions";
import type { CrmEtapa, CrmFunilId, CrmModelo } from "@/lib/crm/types";
import { CANAIS, fmtDia, labelDe, VARIAVEIS_MODELO } from "@/lib/crm/utils";

export const Route = createFileRoute("/_crm/config")({
  component: ConfigPage,
});

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin (vê tudo, configura)",
  comercial: "Comercial (leads e negócios)",
  editorial: "Editorial (menções e pautas)",
  editor: "Editorial (papel antigo)",
  reader: "Sem acesso ao CRM",
};

function ConfigPage() {
  const { isAdmin } = useCrm();
  if (!isAdmin) return <Erro erro={new Error("Só o administrador acessa a configuração.")} />;
  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Configuração"
        descricao="Funis, etapas e prazos, modelos de mensagem, usuários e papéis. Só admin."
      />
      <Tabs defaultValue="etapas">
        <TabsList className="h-10">
          <TabsTrigger value="etapas">Funis e etapas</TabsTrigger>
          <TabsTrigger value="modelos">Modelos de mensagem</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários e papéis</TabsTrigger>
        </TabsList>
        <TabsContent value="etapas" className="mt-4">
          <Etapas />
        </TabsContent>
        <TabsContent value="modelos" className="mt-4">
          <Modelos />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-4">
          <Usuarios />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Etapas() {
  const { funis, etapas } = useCrm();
  const [nova, setNova] = useState<CrmFunilId | null>(null);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Ao entrar numa etapa, o CRM cria a tarefa da ação padrão com o prazo em dias. Etapa sem
        prazo não cria tarefa. Etapas ganhas marcam a empresa como cliente/anunciante.
      </p>
      {funis.map((f) => (
        <Secao
          key={f.id}
          titulo={f.nome}
          acoes={
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setNova(f.id)}>
              <Plus className="mr-1 h-4 w-4" /> Etapa
            </Button>
          }
        >
          <div className="space-y-2">
            <div className="hidden grid-cols-[60px_1.2fr_70px_1.6fr_110px_70px_44px] gap-2 text-[11px] font-semibold text-muted-foreground lg:grid">
              <span>Ordem</span>
              <span>Nome</span>
              <span>Prazo</span>
              <span>Ação padrão</span>
              <span>Tipo</span>
              <span>Ativa</span>
              <span />
            </div>
            {etapas
              .filter((e) => e.funil_id === f.id)
              .sort((a, b) => a.ordem - b.ordem)
              .map((e) => (
                <LinhaEtapa key={e.id} etapa={e} />
              ))}
            {nova === f.id ? (
              <LinhaEtapa
                etapa={{
                  funil_id: f.id,
                  nome: "",
                  ordem: 50,
                  prazo_dias: 3,
                  acao_padrao: "",
                  tipo: "aberta",
                  ativo: true,
                }}
                onFim={() => setNova(null)}
              />
            ) : null}
          </div>
        </Secao>
      ))}
    </div>
  );
}

function LinhaEtapa({ etapa, onFim }: { etapa: Partial<CrmEtapa>; onFim?: () => void }) {
  const salvar = useServerFn(saveEtapa);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<EtapaInput>({});
  useEffect(() => {
    setF({
      id: etapa.id,
      funil_id: etapa.funil_id,
      nome: etapa.nome ?? "",
      ordem: etapa.ordem ?? 0,
      prazo_dias: etapa.prazo_dias ?? "",
      acao_padrao: etapa.acao_padrao ?? "",
      criterio_entrada: etapa.criterio_entrada ?? "",
      tipo: etapa.tipo ?? "aberta",
      ativo: etapa.ativo ?? true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia só quando muda a etapa (a linha nova não tem id)
  }, [
    etapa.id,
    etapa.nome,
    etapa.ordem,
    etapa.prazo_dias,
    etapa.acao_padrao,
    etapa.tipo,
    etapa.ativo,
  ]);
  const set = <K extends keyof EtapaInput>(k: K, v: EtapaInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border p-2 lg:grid-cols-[60px_1.2fr_70px_1.6fr_110px_70px_44px] lg:border-0 lg:p-0">
      <Input
        aria-label="Ordem"
        inputMode="numeric"
        value={String(f.ordem ?? "")}
        onChange={(e) => set("ordem", e.target.value.replace(/\D/g, ""))}
        className="h-9"
      />
      <Input
        aria-label="Nome"
        value={f.nome ?? ""}
        onChange={(e) => set("nome", e.target.value)}
        className="h-9"
      />
      <Input
        aria-label="Prazo em dias"
        inputMode="numeric"
        placeholder="—"
        value={String(f.prazo_dias ?? "")}
        onChange={(e) => set("prazo_dias", e.target.value.replace(/\D/g, ""))}
        className="h-9"
      />
      <Input
        aria-label="Ação padrão"
        value={f.acao_padrao ?? ""}
        onChange={(e) => set("acao_padrao", e.target.value)}
        className="h-9"
      />
      <Select value={f.tipo ?? "aberta"} onValueChange={(v) => set("tipo", v)}>
        <SelectTrigger className="h-9" aria-label="Tipo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="aberta">Aberta</SelectItem>
          <SelectItem value="ganha">Ganha</SelectItem>
          <SelectItem value="perdida">Perdida</SelectItem>
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={f.ativo !== false} onCheckedChange={(v) => set("ativo", v === true)} />{" "}
        ativa
      </label>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9"
        aria-label="Salvar etapa"
        disabled={ocupado || !f.nome?.trim()}
        onClick={async () => {
          const r = await executar(() => salvar({ data: f }), "Etapa salva.");
          if (r) onFim?.();
        }}
      >
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function Modelos() {
  const { etapa, etapas, funilNome } = useCrm();
  const { data, isLoading, error } = useModelos();
  const [editar, setEditar] = useState<Partial<CrmModelo> | null>(null);
  if (isLoading) return <Carregando />;
  if (error) return <Erro erro={error} />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Assinatura “Renata, da IA News” (sempre no feminino). 1ª mensagem sem valor; valor só na
          3ª mensagem; reativação só pergunta se ainda há interesse.
        </p>
        <Button size="sm" onClick={() => setEditar({ ativo: true, ordem: 200, canal: "direct" })}>
          <Plus className="mr-1.5 h-4 w-4" /> Modelo
        </Button>
      </div>
      {data?.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((m) => {
            const e = etapa(m.etapa_id);
            return (
              <li key={m.id} className="rounded-[var(--radius)] border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="text-left font-semibold hover:text-primary"
                    onClick={() => setEditar(m)}
                  >
                    {m.nome}
                  </button>
                  <div className="flex gap-1">
                    <Etiqueta>{labelDe(CANAIS, m.canal)}</Etiqueta>
                    {!m.ativo ? <Etiqueta tom="alerta">inativo</Etiqueta> : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {e ? `${funilNome(e.funil_id)} · ${e.nome}` : "Qualquer etapa"}
                </p>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                  {m.texto}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <Vazio>Nenhum modelo.</Vazio>
      )}
      <ModeloDialog modelo={editar} etapas={etapas} onClose={() => setEditar(null)} />
    </div>
  );
}

function ModeloDialog({
  modelo,
  etapas,
  onClose,
}: {
  modelo: Partial<CrmModelo> | null;
  etapas: CrmEtapa[];
  onClose: () => void;
}) {
  const { funilNome } = useCrm();
  const salvar = useServerFn(saveModelo);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<ModeloInput>({});
  useEffect(() => {
    if (modelo)
      setF({
        id: modelo.id,
        nome: modelo.nome ?? "",
        canal: modelo.canal ?? "direct",
        etapa_id: modelo.etapa_id ?? null,
        texto: modelo.texto ?? "",
        ordem: modelo.ordem ?? 0,
        ativo: modelo.ativo ?? true,
      });
  }, [modelo]);
  const set = <K extends keyof ModeloInput>(k: K, v: ModeloInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={!!modelo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          <DialogDescription>Variáveis: {VARIAVEIS_MODELO.join(" ")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome *" className="sm:col-span-2">
            <Input value={f.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
          </Campo>
          <Campo rotulo="Canal">
            <Select value={f.canal ?? "direct"} onValueChange={(v) => set("canal", v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANAIS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Etapa sugerida">
            <Select
              value={f.etapa_id ?? "nenhuma"}
              onValueChange={(v) => set("etapa_id", v === "nenhuma" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Qualquer etapa</SelectItem>
                {etapas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {funilNome(e.funil_id)} · {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Texto *" className="sm:col-span-2">
            <Textarea
              rows={10}
              value={f.texto ?? ""}
              onChange={(e) => set("texto", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Ordem">
            <Input
              inputMode="numeric"
              value={String(f.ordem ?? "")}
              onChange={(e) => set("ordem", e.target.value.replace(/\D/g, ""))}
            />
          </Campo>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Checkbox
              checked={f.ativo !== false}
              onCheckedChange={(v) => set("ativo", v === true)}
            />{" "}
            Ativo
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado || !f.nome?.trim() || !f.texto?.trim()}
            onClick={async () => {
              const r = await executar(() => salvar({ data: f }), "Modelo salvo.");
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

function Usuarios() {
  const { userId } = useCrm();
  const fetchUsuarios = useServerFn(listUsuarios);
  const definir = useServerFn(setPapel);
  const { executar } = useAcao();
  const [q, setQ] = useState("");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["crm", "usuarios"],
    queryFn: () => fetchUsuarios(),
  });
  if (isLoading) return <Carregando />;
  if (error) return <Erro erro={error} />;
  const lista = (data ?? []).filter((u) =>
    `${u.nome} ${u.email}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A pessoa cria a conta na tela de login do CRM e você define o papel aqui. Só admin,
        comercial e editorial veem o CRM.
      </p>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar conta por nome ou e-mail"
        className="h-10 sm:max-w-sm"
      />
      {lista.length ? (
        <ul className="divide-y rounded-[var(--radius)] border bg-card">
          {lista.map((u) => {
            const papel = (u.papeis.find((p) => p !== "reader") ?? "reader") as string;
            return (
              <li
                key={u.user_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.nome}{" "}
                    {u.user_id === userId ? (
                      <span className="text-xs text-muted-foreground">(você)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · conta desde {fmtDia(u.created_at)}
                  </p>
                </div>
                <Select
                  value={papel === "editor" ? "editorial" : papel}
                  onValueChange={async (v) => {
                    await executar(
                      () => definir({ data: { user_id: u.user_id, papel: v as PapelEquipe } }),
                      "Papel atualizado.",
                    );
                    await refetch();
                  }}
                  disabled={u.user_id === userId}
                >
                  <SelectTrigger className="h-9 w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["admin", "comercial", "editorial", "reader"] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PAPEL_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
      ) : (
        <Vazio>Nenhuma conta encontrada.</Vazio>
      )}
    </div>
  );
}
