import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { maskPhone } from "@/lib/pauta-validate";
import { metaCtx, novoEventId, pixel } from "@/lib/pixel";
import { CANAL_URL, CONTATO, MAX_INDICADOS, VAZIA, validar, type Erros, type Inscricao, type Tipo } from "@/lib/inscricao";

/* Peças comuns dos formulários de /lista100, /aula, /conselho e /projetos, no visual do /palco (pc2).
   O envio vai para /api/public/inscricao, que grava e leva a pessoa ao CRM. */

const FALHA = `Não conseguimos guardar seu envio agora. Tente de novo ou escreva para ${CONTATO}.`;

const ORDEM: (keyof Inscricao)[] = [
  "nome", "empresa", "cargo", "whatsapp", "email", "instagram", "linkedin", "perfil", "categoria", "caso", "resultado",
  "setor", "porte", "problema", "prazo", "investimento", "horario", "consentimento",
];

export type Feito = { nome: string; already: boolean; agendado_em: string | null };

export function useInscricao(tipo: Tipo, inicial: Partial<Inscricao> = {}) {
  const [form, setForm] = useState<Inscricao>({ ...VAZIA, ...inicial, tipo });
  const [erros, setErros] = useState<Erros>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<Feito | null>(null);
  const hp = useRef<HTMLInputElement>(null);
  const origem = useRef<string | null>(null);
  const utm = useRef<Record<string, string | null>>({});

  useEffect(() => {
    try {
      if (document.referrer) {
        const r = new URL(document.referrer);
        origem.current = r.host === window.location.host ? r.pathname : r.host;
      }
      const q = new URLSearchParams(window.location.search);
      utm.current = {
        utm_source: q.get("utm_source")?.slice(0, 80) ?? null,
        utm_medium: q.get("utm_medium")?.slice(0, 80) ?? null,
        utm_campaign: q.get("utm_campaign")?.slice(0, 120) ?? null,
      };
    } catch {
      origem.current = null;
    }
  }, []);

  function set<K extends keyof Inscricao>(k: K, v: Inscricao[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    if (erros[k]) setErros((e) => ({ ...e, [k]: undefined }));
  }

  async function enviar(e: FormEvent, aoDarConflito?: () => void) {
    e.preventDefault();
    if (enviando) return;
    setFalha(null);
    const { erros: achados } = validar(form);
    if (Object.keys(achados).length) {
      setErros(achados);
      const primeiro = ORDEM.find((k) => achados[k]) ?? Object.keys(achados)[0];
      const el = document.getElementById(`in-${primeiro}`) ?? document.querySelector<HTMLElement>(`[data-campo="${primeiro}"] input`);
      el?.focus();
      return;
    }
    setEnviando(true);
    try {
      const eventId = novoEventId(tipo);
      const res = await fetch("/api/public/inscricao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, empresa_site: hp.current?.value ?? "", origem_path: origem.current, ...utm.current, meta: metaCtx(eventId) }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        already?: boolean;
        agendado_em?: string | null;
        error?: string;
        errors?: Erros;
        refresh?: boolean;
      };
      if (res.ok && json.ok) {
        // Pixel da Meta: Conselho e Balcão contam como Lead; Aula e Lista 100 como cadastro.
        if (tipo === "conselho" || tipo === "projeto") pixel("Lead", { content_name: tipo === "conselho" ? "Conselho IA News" : "Balcão de Projetos", content_category: tipo }, eventId);
        else pixel("CompleteRegistration", { content_name: tipo, content_category: tipo }, eventId);
        setFeito({ nome: form.nome.trim().split(/\s+/)[0] ?? "", already: json.already === true, agendado_em: json.agendado_em ?? null });
        return;
      }
      if (json.errors) setErros(json.errors);
      if (json.refresh) aoDarConflito?.();
      setFalha(json.error ?? (json.errors ? "Confira os campos marcados." : FALHA));
    } catch {
      setFalha(FALHA);
    } finally {
      setEnviando(false);
    }
  }

  return { form, set, erros, falha, enviando, feito, enviar, hp };
}

type CampoProps = React.InputHTMLAttributes<HTMLInputElement> & {
  k: "nome" | "empresa" | "cargo" | "whatsapp" | "email" | "instagram" | "linkedin";
  rotulo: string;
  opcional?: boolean;
  cheio?: boolean;
  f: ReturnType<typeof useInscricao>;
};

export function Campo({ k, rotulo, opcional, cheio, f, ...rest }: CampoProps) {
  const err = f.erros[k];
  return (
    <label className={"f" + (cheio ? " full" : "")} htmlFor={`in-${k}`}>
      <span>
        {rotulo} {opcional ? <small className="pt-opt">opcional</small> : null}
      </span>
      <input
        className={"field" + (err ? " pt-bad" : "")}
        id={`in-${k}`}
        value={f.form[k]}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `in-${k}-err` : undefined}
        onChange={(e) => f.set(k, k === "whatsapp" ? maskPhone(e.target.value) : e.target.value)}
        {...rest}
      />
      {err ? (
        <span className="pt-err" id={`in-${k}-err`}>
          {err}
        </span>
      ) : null}
    </label>
  );
}

export function Texto({
  k,
  rotulo,
  dica,
  max,
  linhas = 3,
  placeholder,
  f,
}: {
  k: "caso" | "resultado" | "problema";
  rotulo: string;
  dica?: string;
  max: number;
  linhas?: number;
  placeholder?: string;
  f: ReturnType<typeof useInscricao>;
}) {
  const err = f.erros[k];
  return (
    <label className="f full" htmlFor={`in-${k}`}>
      <span>{rotulo}</span>
      {dica ? <small className="ins-dica">{dica}</small> : null}
      <textarea
        className={"field" + (err ? " pt-bad" : "")}
        id={`in-${k}`}
        rows={linhas}
        maxLength={max}
        value={f.form[k]}
        placeholder={placeholder}
        aria-invalid={err ? true : undefined}
        onChange={(e) => f.set(k, e.target.value)}
      />
      <span className="ins-conta">
        {f.form[k].length}/{max}
      </span>
      {err ? <span className="pt-err">{err}</span> : null}
    </label>
  );
}

export function Escolha({
  k,
  rotulo,
  opcoes,
  opcional,
  f,
}: {
  k: "setor" | "porte" | "prazo" | "investimento" | "perfil" | "categoria";
  rotulo: string;
  opcoes: { value: string; label: string }[] | string[];
  opcional?: boolean;
  f: ReturnType<typeof useInscricao>;
}) {
  const err = f.erros[k];
  const lista = opcoes.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <label className="f" htmlFor={`in-${k}`}>
      <span>
        {rotulo} {opcional ? <small className="pt-opt">opcional</small> : null}
      </span>
      <select
        className={"field" + (err ? " pt-bad" : "")}
        id={`in-${k}`}
        value={f.form[k]}
        aria-invalid={err ? true : undefined}
        onChange={(e) => f.set(k, e.target.value)}
      >
        <option value="">Escolha</option>
        {lista.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {err ? <span className="pt-err">{err}</span> : null}
    </label>
  );
}

export function Pilulas({
  k,
  legenda,
  opcoes,
  f,
  colunas = 2,
}: {
  k: "perfil" | "categoria";
  legenda: string;
  opcoes: { value: string; label: string; hint?: string }[];
  f: ReturnType<typeof useInscricao>;
  colunas?: 1 | 2;
}) {
  const err = f.erros[k];
  return (
    <fieldset data-campo={k} aria-describedby={err ? `in-${k}-err` : undefined}>
      <legend className="pc2-legend">{legenda}</legend>
      <div className={"pc2-pills" + (colunas === 1 ? " ins-pills-1" : "")}>
        {opcoes.map((o, i) => (
          <label className="pc2-pill" key={o.value} title={o.hint}>
            <input
              type="radio"
              name={k}
              id={i === 0 ? `in-${k}` : undefined}
              value={o.value}
              checked={f.form[k] === o.value}
              onChange={() => f.set(k, o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {err ? (
        <span className="pt-err" id={`in-${k}-err`}>
          {err}
        </span>
      ) : null}
    </fieldset>
  );
}

/** Campos "indique alguém": nome, empresa e contato (@, WhatsApp ou e-mail). */
export function Indicados({ f, titulo, minimo = 0 }: { f: ReturnType<typeof useInscricao>; titulo: ReactNode; minimo?: number }) {
  const lista = f.form.indicados.length ? f.form.indicados : Array.from({ length: Math.max(minimo, 1) }, () => ({ nome: "", empresa: "", contato: "" }));
  const muda = (i: number, k: "nome" | "empresa" | "contato", v: string) => {
    const nova = lista.map((x, j) => (j === i ? { ...x, [k]: v } : x));
    f.set("indicados", nova);
  };
  return (
    <fieldset className="ins-ind" data-campo="indicados">
      <legend className="pc2-legend">{titulo}</legend>
      {lista.map((x, i) => {
        const err = f.erros[`indicado${i}`];
        return (
          <div className="ins-ind-row" key={i}>
            <input
              className={"field" + (err && !x.nome ? " pt-bad" : "")}
              aria-label={`Nome da pessoa ${i + 1}`}
              placeholder="Nome"
              maxLength={160}
              value={x.nome}
              onChange={(e) => muda(i, "nome", e.target.value)}
            />
            <input
              className="field"
              aria-label={`Empresa da pessoa ${i + 1}`}
              placeholder="Empresa"
              maxLength={160}
              value={x.empresa}
              onChange={(e) => muda(i, "empresa", e.target.value)}
            />
            <input
              className={"field" + (err && x.nome ? " pt-bad" : "")}
              aria-label={`Contato da pessoa ${i + 1}`}
              placeholder="@instagram, WhatsApp ou e-mail"
              maxLength={160}
              value={x.contato}
              onChange={(e) => muda(i, "contato", e.target.value)}
            />
            {err ? <span className="pt-err">{err}</span> : null}
          </div>
        );
      })}
      {f.erros.indicados ? <span className="pt-err">{f.erros.indicados}</span> : null}
      {lista.length < MAX_INDICADOS ? (
        <button
          type="button"
          className="ins-mais"
          onClick={() => f.set("indicados", [...lista, { nome: "", empresa: "", contato: "" }])}
        >
          + Indicar mais uma pessoa
        </button>
      ) : null}
    </fieldset>
  );
}

export function Aceite({ f, texto }: { f: ReturnType<typeof useInscricao>; texto: string }) {
  return (
    <label className="pt-consent" htmlFor="in-consentimento">
      <input
        id="in-consentimento"
        type="checkbox"
        checked={f.form.consentimento}
        onChange={(e) => f.set("consentimento", e.target.checked)}
        aria-invalid={f.erros.consentimento ? true : undefined}
      />
      <span>
        {texto} Nada é compartilhado com terceiros. <Link to="/termos">Política de privacidade</Link>.
        {f.erros.consentimento ? <span className="pt-err">{f.erros.consentimento}</span> : null}
      </span>
    </label>
  );
}

export function Enviar({ f, rotulo, fino }: { f: ReturnType<typeof useInscricao>; rotulo: string; fino?: string }) {
  return (
    <div className="biz-submit">
      <button className="btn blue pc2-submit" type="submit" disabled={f.enviando}>
        {f.enviando ? "Enviando…" : rotulo}
      </button>
      {fino ? <span className="fine">{fino}</span> : null}
      <p className="msg err" role="status" aria-live="polite">
        {f.falha ?? ""}
      </p>
    </div>
  );
}

export function Isca({ f }: { f: ReturnType<typeof useInscricao> }) {
  return <input ref={f.hp} className="hp" type="text" name="empresa_site" tabIndex={-1} autoComplete="off" aria-hidden="true" />;
}

export function Pronto({ titulo, children, canal = true }: { titulo: string; children: ReactNode; canal?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }), []);
  return (
    <div className="biz-done" ref={ref} role="status">
      <span className="ok-mark" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <h2>{titulo}</h2>
      {children}
      {canal ? (
        <div className="ins-canal">
          <p>
            <b>Entre no canal da IA News no WhatsApp.</b> Todo dia, às 7h, as notícias de IA que importam para quem tem negócio.
          </p>
          <a className="btn blue" href={CANAL_URL} target="_blank" rel="noopener noreferrer">
            Entrar no canal das 7h
          </a>
        </div>
      ) : null}
    </div>
  );
}
