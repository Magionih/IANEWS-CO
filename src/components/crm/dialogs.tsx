import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

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
import { registrarAtividade } from "@/lib/crm/atividades.functions";
import { saveEmpresa, type EmpresaInput } from "@/lib/crm/empresas.functions";
import { savePessoa, type PessoaInput } from "@/lib/crm/pessoas.functions";
import { saveTarefa, type TarefaInput } from "@/lib/crm/tarefas.functions";
import type { CrmAtividadeTipo, CrmEmpresa, CrmGrupo, CrmPessoa } from "@/lib/crm/types";
import {
  ATIVIDADE_LABEL,
  ATIVIDADES_MANUAIS,
  CANAIS,
  faltaVariavel,
  hojeBR,
  linkMateria,
  linkWhatsApp,
  ORIGENS,
  PORTES,
  preencherModelo,
  VARIAVEIS_MODELO,
} from "@/lib/crm/utils";

import { useCrm } from "./context";
import { EmpresaPicker, MembroSelect, PessoaPicker } from "./pickers";
import { useAcao, useModelos } from "./queries";
import { Campo } from "./ui";

/* Diálogos do CRM: empresa, pessoa, tarefa, atividade e mensagem a partir de modelo. */

type Aberto = { aberto: boolean; onClose: () => void };

// ---------------- Empresa ----------------

export function EmpresaDialog({
  aberto,
  onClose,
  empresa,
  onSalva,
}: Aberto & { empresa?: Partial<CrmEmpresa> | null; onSalva?: (id: string) => void }) {
  const { isAdmin } = useCrm();
  const salvar = useServerFn(saveEmpresa);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<EmpresaInput>({ nome: "" });

  useEffect(() => {
    if (!aberto) return;
    setF({
      id: empresa?.id,
      nome: empresa?.nome ?? "",
      site: empresa?.site ?? "",
      instagram: empresa?.instagram ?? "",
      linkedin: empresa?.linkedin ?? "",
      setor: empresa?.setor ?? "",
      cidade: empresa?.cidade ?? "",
      pais: empresa?.pais ?? "Brasil",
      brasileira: empresa?.brasileira ?? true,
      porte: empresa?.porte ?? "",
      seguidores_instagram: empresa?.seguidores_instagram ?? "",
      descricao: empresa?.descricao ?? "",
      interagiu: empresa?.interagiu ?? false,
      noticia_recente_em: empresa?.noticia_recente_em ?? "",
      e_cliente: empresa?.e_cliente ?? false,
      e_anunciante: empresa?.e_anunciante ?? false,
      origem: empresa?.origem ?? "prospeccao",
      dono_id: empresa?.dono_id ?? null,
      ativo: empresa?.ativo ?? true,
      grupo_manual: empresa?.grupo_manual ?? false,
      grupo: empresa?.grupo ?? "",
      motivo_grupo: empresa?.motivo_grupo ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reinicia ao abrir ou ao trocar o cadastro
  }, [aberto, empresa?.id]);

  const set = <K extends keyof EmpresaInput>(k: K, v: EmpresaInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));

  async function enviar() {
    const payload = { ...f };
    if (!isAdmin) {
      delete payload.grupo_manual;
      delete payload.grupo;
      delete payload.motivo_grupo;
    }
    const r = await executar(
      () => salvar({ data: payload }),
      f.id ? "Empresa atualizada." : "Empresa cadastrada.",
    );
    if (r) {
      onSalva?.(r.id);
      onClose();
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          <DialogDescription>
            Cadastro único: o nome não pode repetir (sem diferença de maiúsculas). A pontuação e o
            grupo são calculados pelo sistema.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome *" className="sm:col-span-2">
            <Input value={f.nome ?? ""} onChange={(e) => set("nome", e.target.value)} autoFocus />
          </Campo>
          <Campo rotulo="Site">
            <Input
              value={f.site ?? ""}
              onChange={(e) => set("site", e.target.value)}
              placeholder="empresa.com.br"
            />
          </Campo>
          <Campo rotulo="Instagram">
            <Input
              value={f.instagram ?? ""}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder="@empresa"
            />
          </Campo>
          <Campo rotulo="LinkedIn">
            <Input
              value={f.linkedin ?? ""}
              onChange={(e) => set("linkedin", e.target.value)}
              placeholder="link da página"
            />
          </Campo>
          <Campo rotulo="Seguidores no Instagram">
            <Input
              inputMode="numeric"
              value={f.seguidores_instagram ?? ""}
              onChange={(e) => set("seguidores_instagram", e.target.value.replace(/\D/g, ""))}
            />
          </Campo>
          <Campo rotulo="Setor">
            <Input
              value={f.setor ?? ""}
              onChange={(e) => set("setor", e.target.value)}
              placeholder="fintech, saúde, agro..."
            />
          </Campo>
          <Campo rotulo="Porte">
            <Select
              value={f.porte || "nenhum"}
              onValueChange={(v) =>
                set("porte", v === "nenhum" ? "" : (v as EmpresaInput["porte"]))
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Não informado</SelectItem>
                {PORTES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Cidade">
            <Input value={f.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
          </Campo>
          <Campo rotulo="País">
            <Input value={f.pais ?? ""} onChange={(e) => set("pais", e.target.value)} />
          </Campo>
          <Campo rotulo="Origem">
            <Select value={f.origem || "outro"} onValueChange={(v) => set("origem", v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGENS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Dono">
            <MembroSelect valor={f.dono_id ?? null} onChange={(v) => set("dono_id", v)} />
          </Campo>
          <Campo rotulo="Notícia recente (rodada, lançamento)" dica="Vale +10 pontos por 90 dias.">
            <Input
              type="date"
              value={f.noticia_recente_em ?? ""}
              onChange={(e) => set("noticia_recente_em", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Descrição" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={f.descricao ?? ""}
              onChange={(e) => set("descricao", e.target.value)}
            />
          </Campo>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            {(
              [
                ["brasileira", "Brasileira ou com operação no Brasil"],
                ["interagiu", "Interagiu com o conteúdo (collab, comentário, resposta)"],
                ["e_cliente", "Já é cliente"],
                ["e_anunciante", "É anunciante"],
                ["ativo", "Cadastro ativo"],
              ] as const
            ).map(([k, rotulo]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!f[k]} onCheckedChange={(v) => set(k, v === true)} /> {rotulo}
              </label>
            ))}
          </div>
          {isAdmin ? (
            <div className="space-y-2 rounded-lg border border-dashed p-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Checkbox
                  checked={!!f.grupo_manual}
                  onCheckedChange={(v) => set("grupo_manual", v === true)}
                />
                Definir o grupo à mão (só admin)
              </label>
              {f.grupo_manual ? (
                <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                  <Select
                    value={(f.grupo as string) || "B"}
                    onValueChange={(v) => set("grupo", v as CrmGrupo)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["A", "B", "C"] as const).map((g) => (
                        <SelectItem key={g} value={g}>
                          Grupo {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={f.motivo_grupo ?? ""}
                    onChange={(e) => set("motivo_grupo", e.target.value)}
                    placeholder="Motivo (obrigatório)"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  O grupo segue a pontuação: A (70+), B (40 a 69), C (abaixo de 40).
                </p>
              )}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={ocupado || !f.nome?.trim()}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Pessoa ----------------

export function PessoaDialog({
  aberto,
  onClose,
  pessoa,
  empresaId,
  onSalva,
}: Aberto & {
  pessoa?: Partial<CrmPessoa> | null;
  empresaId?: string | null;
  onSalva?: (id: string) => void;
}) {
  const salvar = useServerFn(savePessoa);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<PessoaInput>({ nome: "" });

  useEffect(() => {
    if (!aberto) return;
    setF({
      id: pessoa?.id,
      nome: pessoa?.nome ?? "",
      email: pessoa?.email ?? "",
      whatsapp: pessoa?.whatsapp ?? "",
      instagram: pessoa?.instagram ?? "",
      linkedin: pessoa?.linkedin ?? "",
      seguidores_instagram: pessoa?.seguidores_instagram ?? "",
      consentimento: pessoa?.consentimento ?? false,
      origem: pessoa?.origem ?? "prospeccao",
      notas: pessoa?.notas ?? "",
      dono_id: pessoa?.dono_id ?? null,
      ativo: pessoa?.ativo ?? true,
      ...(pessoa?.id ? {} : { empresa_id: empresaId ?? null, cargo: "", decisor: false }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reinicia ao abrir ou ao trocar o cadastro
  }, [aberto, pessoa?.id, empresaId]);

  const set = <K extends keyof PessoaInput>(k: K, v: PessoaInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));

  async function enviar() {
    const r = await executar(
      () => salvar({ data: f }),
      f.id ? "Pessoa atualizada." : "Pessoa cadastrada.",
    );
    if (r) {
      onSalva?.(r.id);
      onClose();
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
          <DialogDescription>
            Uma pessoa por e-mail. Registre o consentimento quando a pessoa autorizar o contato
            (LGPD).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome *" className="sm:col-span-2">
            <Input value={f.nome ?? ""} onChange={(e) => set("nome", e.target.value)} autoFocus />
          </Campo>
          <Campo rotulo="E-mail">
            <Input
              type="email"
              value={f.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </Campo>
          <Campo rotulo="WhatsApp">
            <Input
              inputMode="tel"
              value={f.whatsapp ?? ""}
              onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="(11) 99999-0000"
            />
          </Campo>
          <Campo rotulo="Instagram">
            <Input
              value={f.instagram ?? ""}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder="@pessoa"
            />
          </Campo>
          <Campo rotulo="LinkedIn">
            <Input
              value={f.linkedin ?? ""}
              onChange={(e) => set("linkedin", e.target.value)}
              placeholder="link do perfil"
            />
          </Campo>
          <Campo rotulo="Seguidores no Instagram">
            <Input
              inputMode="numeric"
              value={f.seguidores_instagram ?? ""}
              onChange={(e) => set("seguidores_instagram", e.target.value.replace(/\D/g, ""))}
            />
          </Campo>
          <Campo rotulo="Dono">
            <MembroSelect valor={f.dono_id ?? null} onChange={(v) => set("dono_id", v)} />
          </Campo>
          {!f.id ? (
            <>
              <Campo rotulo="Empresa">
                <EmpresaPicker
                  valor={f.empresa_id ?? null}
                  onChange={(v) => set("empresa_id", v)}
                />
              </Campo>
              <Campo rotulo="Cargo">
                <Input
                  value={f.cargo ?? ""}
                  onChange={(e) => set("cargo", e.target.value)}
                  placeholder="CEO e fundadora"
                />
              </Campo>
            </>
          ) : null}
          <Campo rotulo="Notas" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={f.notas ?? ""}
              onChange={(e) => set("notas", e.target.value)}
            />
          </Campo>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!f.consentimento}
                onCheckedChange={(v) => set("consentimento", v === true)}
              />{" "}
              Consentiu com o contato
            </label>
            {!f.id && f.empresa_id ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!f.decisor}
                  onCheckedChange={(v) => set("decisor", v === true)}
                />{" "}
                É decisor (fundador/executivo)
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={f.ativo !== false}
                onCheckedChange={(v) => set("ativo", v === true)}
              />{" "}
              Cadastro ativo
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={ocupado || !f.nome?.trim()}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Tarefa ----------------

export function TarefaDialog({
  aberto,
  onClose,
  tarefa,
  vinculo,
}: Aberto & {
  tarefa?: (TarefaInput & { id?: string }) | null;
  vinculo?: { empresa_id?: string | null; pessoa_id?: string | null; negocio_id?: string | null };
}) {
  const { userId } = useCrm();
  const salvar = useServerFn(saveTarefa);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<TarefaInput>({ titulo: "" });

  useEffect(() => {
    if (!aberto) return;
    setF({
      id: tarefa?.id,
      titulo: tarefa?.titulo ?? "",
      descricao: tarefa?.descricao ?? "",
      vence_em: tarefa?.vence_em ?? hojeBR(),
      responsavel_id: tarefa?.id
        ? (tarefa.responsavel_id ?? null)
        : (tarefa?.responsavel_id ?? userId),
      empresa_id: tarefa?.empresa_id ?? vinculo?.empresa_id ?? null,
      pessoa_id: tarefa?.pessoa_id ?? vinculo?.pessoa_id ?? null,
      negocio_id: tarefa?.negocio_id ?? vinculo?.negocio_id ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reinicia ao abrir ou ao trocar o alvo
  }, [aberto, tarefa?.id, JSON.stringify(vinculo), userId]);

  const set = <K extends keyof TarefaInput>(k: K, v: TarefaInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));

  async function enviar() {
    const r = await executar(
      () => salvar({ data: f }),
      f.id ? "Tarefa atualizada." : "Tarefa criada.",
    );
    if (r) onClose();
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Campo rotulo="O que fazer *">
            <Input
              value={f.titulo ?? ""}
              onChange={(e) => set("titulo", e.target.value)}
              autoFocus
            />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Vence em">
              <Input
                type="date"
                value={f.vence_em ?? ""}
                onChange={(e) => set("vence_em", e.target.value)}
              />
            </Campo>
            <Campo rotulo="Responsável">
              <MembroSelect
                valor={f.responsavel_id ?? null}
                onChange={(v) => set("responsavel_id", v)}
              />
            </Campo>
          </div>
          {!vinculo?.negocio_id ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Empresa">
                <EmpresaPicker
                  valor={f.empresa_id ?? null}
                  onChange={(v) => set("empresa_id", v)}
                />
              </Campo>
              <Campo rotulo="Pessoa">
                <PessoaPicker
                  valor={f.pessoa_id ?? null}
                  empresaId={f.empresa_id}
                  onChange={(v) => set("pessoa_id", v)}
                />
              </Campo>
            </div>
          ) : null}
          <Campo rotulo="Detalhes">
            <Textarea
              rows={3}
              value={f.descricao ?? ""}
              onChange={(e) => set("descricao", e.target.value)}
            />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={ocupado || !f.titulo?.trim()}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Atividade ----------------

export type AlvoAtividade = {
  empresa_id?: string | null;
  pessoa_id?: string | null;
  negocio_id?: string | null;
};

export function AtividadeDialog({
  aberto,
  onClose,
  alvo,
  tipoInicial,
}: Aberto & { alvo: AlvoAtividade; tipoInicial?: CrmAtividadeTipo }) {
  const registrar = useServerFn(registrarAtividade);
  const { executar, ocupado } = useAcao();
  const [tipo, setTipo] = useState<CrmAtividadeTipo>("nota");
  const [canal, setCanal] = useState<string>("whatsapp");
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setTipo(tipoInicial ?? "nota");
    setCanal("whatsapp");
    setTexto("");
  }, [aberto, tipoInicial]);

  const precisaCanal = !["nota", "pagamento"].includes(tipo);

  async function enviar() {
    const r = await executar(
      () =>
        registrar({
          data: { tipo: tipo as never, canal: precisaCanal ? canal : null, texto, ...alvo },
        }),
      (res) =>
        res.movidoPara
          ? `Registrado. Negócio foi para "${res.movidoPara}".`
          : "Atividade registrada.",
    );
    if (r) onClose();
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar conversa ou atividade</DialogTitle>
          <DialogDescription>
            Fica na linha do tempo da empresa, da pessoa e do negócio.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Tipo">
              <Select value={tipo} onValueChange={(v) => setTipo(v as CrmAtividadeTipo)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATIVIDADES_MANUAIS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ATIVIDADE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            {precisaCanal ? (
              <Campo rotulo="Canal">
                <Select value={canal} onValueChange={setCanal}>
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
            ) : null}
          </div>
          <Campo rotulo="Texto">
            <Textarea
              rows={5}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="O que foi dito, combinado ou enviado"
            />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={ocupado || (tipo === "nota" && !texto.trim())}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Mensagem a partir de modelo ----------------

export type DadosMensagem = {
  nome?: string | null;
  empresa?: string | null;
  whatsapp?: string | null;
  article_slug?: string | null;
  link_post?: string | null;
  valor?: number | null;
  etapa_id?: string | null;
  tarefa_id?: string | null;
} & AlvoAtividade;

/** Modelos da Renata: preenche as variáveis, copia, abre no WhatsApp (wa.me) e registra o envio. */
export function MensagemDialog({ aberto, onClose, dados }: Aberto & { dados: DadosMensagem }) {
  const { data: modelos = [] } = useModelos();
  const registrar = useServerFn(registrarAtividade);
  const { executar, ocupado } = useAcao();
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [canal, setCanal] = useState("direct");

  const ativos = useMemo(() => modelos.filter((m) => m.ativo), [modelos]);
  const sugeridos = useMemo(
    () =>
      [...ativos].sort(
        (a, b) =>
          Number(b.etapa_id === dados.etapa_id) - Number(a.etapa_id === dados.etapa_id) ||
          a.ordem - b.ordem,
      ),
    [ativos, dados.etapa_id],
  );

  // Ao abrir: o modelo da etapa atual vem primeiro. Se os modelos chegarem depois, escolhe o primeiro.
  useEffect(() => {
    if (aberto) setModeloId(sugeridos[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia só ao abrir
  }, [aberto]);
  useEffect(() => {
    if (aberto && !modeloId && sugeridos[0]) setModeloId(sugeridos[0].id);
  }, [aberto, modeloId, sugeridos]);

  const chaveDados = JSON.stringify(dados);
  useEffect(() => {
    const m = ativos.find((x) => x.id === modeloId);
    if (!m) return;
    setCanal(m.canal ?? "direct");
    setTexto(
      preencherModelo(m.texto, {
        nome: dados.nome,
        empresa: dados.empresa,
        link_materia: linkMateria(dados.article_slug),
        link_post: dados.link_post,
        valor: dados.valor,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dados comparados pelo conteúdo (chaveDados)
  }, [modeloId, ativos, chaveDados]);

  const wa = linkWhatsApp(dados.whatsapp, texto);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie.");
    }
  }

  async function registrarEnvio() {
    const r = await executar(
      () =>
        registrar({
          data: {
            tipo: canal === "email" ? "email" : "mensagem_enviada",
            canal,
            texto,
            modelo_id: modeloId,
            empresa_id: dados.empresa_id,
            pessoa_id: dados.pessoa_id,
            negocio_id: dados.negocio_id,
            tarefa_id: dados.tarefa_id,
          },
        }),
      (res) =>
        res.movidoPara
          ? `Envio registrado. Negócio foi para "${res.movidoPara}".`
          : "Envio registrado.",
    );
    if (r) onClose();
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mensagem {dados.nome ? `para ${dados.nome}` : ""}</DialogTitle>
          <DialogDescription>
            O CRM monta a mensagem; você envia e clica em “Registrar envio”. Instagram e LinkedIn
            não permitem envio automático.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Campo rotulo="Modelo">
              <Select value={modeloId ?? undefined} onValueChange={setModeloId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Escolha um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {sugeridos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.etapa_id && m.etapa_id === dados.etapa_id ? "★ " : ""}
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="Canal">
              <Select value={canal} onValueChange={setCanal}>
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
          </div>
          <Campo
            rotulo="Texto (pode ajustar antes de enviar)"
            dica={
              faltaVariavel(texto)
                ? "Há dados faltando no texto ([falta ...]). Complete antes de enviar."
                : `Variáveis: ${VARIAVEIS_MODELO.join(" ")}`
            }
          >
            <Textarea rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </Campo>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={copiar} disabled={!texto}>
            <Copy className="mr-2 h-4 w-4" /> Copiar
          </Button>
          {wa ? (
            <Button variant="outline" asChild>
              <a href={wa} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir no WhatsApp
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled title="A pessoa não tem WhatsApp cadastrado">
              <ExternalLink className="mr-2 h-4 w-4" /> Sem WhatsApp
            </Button>
          )}
          <Button
            onClick={registrarEnvio}
            disabled={
              ocupado ||
              !texto.trim() ||
              (!dados.empresa_id && !dados.pessoa_id && !dados.negocio_id)
            }
          >
            {ocupado ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}{" "}
            Registrar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
