import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MailPlus, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { useCrm } from "@/components/crm/context";
import { Carregando, Erro, Secao, Vazio } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { convidarUsuario, getAuditoria } from "@/lib/crm/config.functions";
import { fmtDataHora } from "@/lib/crm/utils";

/* Segurança da conta e da operação: verificação em duas etapas (aplicativo autenticador),
   convite de contas da equipe e a trilha de auditoria das alterações sensíveis. */

type Fator = { id: string; status: string; friendly_name?: string | null; created_at: string };

export function Seguranca() {
  return (
    <div className="space-y-5">
      <DuasEtapas />
      <Convite />
      <Auditoria />
    </div>
  );
}

function DuasEtapas() {
  const [fatores, setFatores] = useState<Fator[] | null>(null);
  const [cadastro, setCadastro] = useState<{ id: string; qr: string; segredo: string } | null>(
    null,
  );
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function carregar() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFatores((data?.totp ?? []) as Fator[]);
  }
  useEffect(() => {
    void carregar();
  }, []);

  const ativo = fatores?.find((f) => f.status === "verified");

  async function comecar() {
    setErro("");
    setOcupado(true);
    try {
      // Limpa tentativas anteriores não concluídas.
      for (const f of fatores ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `CRM IA News ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error || !data) throw error ?? new Error("Falha ao gerar o código.");
      setCadastro({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível começar agora.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!cadastro) return;
    const c = codigo.replace(/\D/g, "");
    if (c.length !== 6) return setErro("Digite os 6 números do aplicativo.");
    setErro("");
    setOcupado(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: cadastro.id,
      code: c,
    });
    setOcupado(false);
    if (error) return setErro("Código incorreto. Confira a hora do celular e tente o próximo.");
    setCadastro(null);
    setCodigo("");
    toast.success("Verificação em duas etapas ativada.");
    await carregar();
  }

  async function desativar() {
    if (!ativo) return;
    if (
      !window.confirm(
        "Desativar a verificação em duas etapas? A conta fica protegida só pela senha.",
      )
    )
      return;
    setOcupado(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: ativo.id });
    setOcupado(false);
    if (error) return setErro("Não foi possível desativar agora.");
    toast.success("Verificação em duas etapas desativada.");
    await carregar();
  }

  return (
    <Secao titulo="Verificação em duas etapas">
      {fatores == null ? (
        <p className="text-[13px] text-muted-foreground">Conferindo...</p>
      ) : ativo ? (
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F6EF] text-[#0B6B49]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Ativada nesta conta</p>
            <p className="text-[13px] text-muted-foreground">
              Ao entrar, o CRM pede a senha e o código de 6 números do aplicativo autenticador.
            </p>
          </div>
          <Button variant="outline" onClick={desativar} disabled={ocupado}>
            <ShieldOff className="h-4 w-4" /> Desativar
          </Button>
        </div>
      ) : cadastro ? (
        <div className="flex flex-wrap gap-6">
          <img
            src={cadastro.qr}
            alt="QR code para o aplicativo autenticador"
            className="h-44 w-44 rounded-xl border bg-white p-2"
          />
          <div className="min-w-0 flex-[1_1_280px] space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground">
              <li>Abra o Google Authenticator, Microsoft Authenticator ou 1Password no celular.</li>
              <li>Escaneie o QR code (ou digite a chave abaixo).</li>
              <li>Digite o código de 6 números que aparecer.</li>
            </ol>
            <p className="break-all rounded-lg bg-background px-3 py-2 font-mono text-[12px]">
              {cadastro.segredo}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="codigo-2fa">Código</Label>
                <Input
                  id="codigo-2fa"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="tabular h-10 w-36 text-center tracking-[0.3em]"
                />
              </div>
              <Button onClick={confirmar} disabled={ocupado} className="h-10">
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Ativar
              </Button>
              <Button variant="ghost" className="h-10" onClick={() => setCadastro(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1E6] text-[#A3400A]">
            <ShieldOff className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Desativada</p>
            <p className="text-[13px] text-muted-foreground">
              Recomendado: mesmo que alguém descubra a senha, não entra sem o código do seu celular.
            </p>
          </div>
          <Button onClick={comecar} disabled={ocupado}>
            {ocupado ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Ativar agora
          </Button>
        </div>
      )}
      {erro ? <p className="mt-3 text-[13px] text-destructive">{erro}</p> : null}
    </Secao>
  );
}

function Convite() {
  const convidar = useServerFn(convidarUsuario);
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      await convidar({ data: { email, origem: window.location.origin } });
      toast.success("Convite enviado. Depois que a pessoa criar a senha, defina o papel dela.");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível convidar.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <Secao titulo="Convidar pessoa da equipe">
      <p className="mb-3 text-[13px] text-muted-foreground">
        Ninguém cria conta sozinho no CRM. A pessoa recebe o convite por e-mail, cria a senha e fica
        sem acesso até você escolher o papel em "Usuários e papéis".
      </p>
      <form onSubmit={enviar} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="convite-email">
          E-mail
        </label>
        <Input
          id="convite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@empresa.com"
          className="h-10 w-72 max-w-full"
          required
        />
        <Button type="submit" className="h-10" disabled={ocupado}>
          {ocupado ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MailPlus className="h-4 w-4" />
          )}
          Enviar convite
        </Button>
      </form>
    </Secao>
  );
}

const TABELA: Record<string, string> = {
  crm_lancamentos: "Lançamento",
  crm_notas_fiscais: "Nota fiscal",
  crm_parametros: "Parâmetro",
  crm_produtos: "Produto",
  user_roles: "Acesso",
  crm_negocios: "Negócio",
  crm_pessoas: "Pessoa",
  crm_empresas: "Empresa",
};
const OPERACAO: Record<string, string> = { INSERT: "criou", UPDATE: "alterou", DELETE: "apagou" };

function resumo(r: {
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  operacao: string;
}): string {
  const fmt = (v: unknown) =>
    v == null ? "vazio" : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (r.operacao === "UPDATE" && r.antes && r.depois) {
    return Object.keys(r.depois)
      .filter((k) => k !== "updated_at" && fmt(r.antes?.[k]) !== fmt(r.depois?.[k]))
      .map((k) => `${k}: ${fmt(r.antes?.[k])} → ${fmt(r.depois?.[k])}`)
      .join(" · ")
      .slice(0, 300);
  }
  const base = (r.depois ?? r.antes ?? {}) as Record<string, unknown>;
  return ["descricao", "titulo", "numero", "nome", "chave", "role", "valor"]
    .filter((k) => base[k] != null)
    .map((k) => `${k}: ${fmt(base[k])}`)
    .join(" · ")
    .slice(0, 300);
}

function Auditoria() {
  const { membro } = useCrm();
  const fetchAud = useServerFn(getAuditoria);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "auditoria"],
    queryFn: () => fetchAud(),
  });
  return (
    <Secao titulo="Trilha de auditoria" contagem={data?.length} colado>
      <p className="px-5 pb-2 text-[13px] text-muted-foreground sm:px-6">
        Quem mexeu em dinheiro, notas fiscais, parâmetros, produtos e acessos, e o que mudou.
        Ninguém consegue apagar ou editar este registro pelo CRM.
      </p>
      {isLoading ? (
        <div className="p-5">
          <Carregando />
        </div>
      ) : error ? (
        <div className="p-5">
          <Erro erro={error} />
        </div>
      ) : data?.length ? (
        <ul className="divide-y">
          {data.map((r) => (
            <li key={r.id} className="px-5 py-2.5 text-[13px] sm:px-6">
              <p>
                <span className="font-semibold">{r.usuario ? membro(r.usuario) : "Sistema"}</span>{" "}
                {OPERACAO[r.operacao] ?? r.operacao}{" "}
                <span className="font-medium">{TABELA[r.tabela] ?? r.tabela}</span>
                <span className="text-muted-foreground"> · {fmtDataHora(r.em)}</span>
              </p>
              <p className="truncate text-[12px] text-muted-foreground" title={resumo(r)}>
                {resumo(r) || "—"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <Vazio>Nenhuma alteração registrada ainda.</Vazio>
        </div>
      )}
    </Secao>
  );
}
