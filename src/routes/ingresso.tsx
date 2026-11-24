import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { PALCO_PIXEL, metaCtx, pixel, pixelOnce } from "@/lib/pixel";
import { maskPhone } from "@/lib/pauta-validate";
import {
  DESAFIO_MAX,
  FATURAMENTOS,
  PALCO_VALOR,
  PAPEIS,
  PORTES,
  SETORES,
  validatePalco,
  validateQualificacao,
  type PalcoErrors,
  type PalcoInput,
  type QualificacaoErrors,
} from "@/lib/palco-validate";
import { FGIA_DIRECT_URL, FGIA_PAGAMENTO_URL, FGIA_SITE } from "@/lib/fgia";

/* Checkout da FGIA Educação para o Palco IA News Online (fgiaeducacao.com.br/ingresso).
   1. Seus dados: nome, WhatsApp e e-mail. Já grava a inscrição em /api/public/palco (checkout "fgia"): o lead entra
      no CRM e recebe o link do pedido mesmo se parar aqui.
   2. Sua empresa (opcional, dá para pular): empresa, cargo, perfil, segmento, funcionários, faturamento e o que quer
      resolver com IA. Vai de novo para /api/public/palco (qualificacao "fgia") e vira uma nota no negócio.
   3. Pagamento: /api/public/palco-checkout cria a cobrança no Asaas. Pix aparece aqui mesmo (QR e copia e cola) e a
      vaga é confirmada sozinha; cartão e boleto seguem para a fatura segura do Asaas.
   4. Ingresso confirmado.
   Se a API do Asaas falhar, a pessoa ainda paga pelo link de pagamento da FGIA (FGIA_PAGAMENTO_URL). */

type Search = { i?: string; t?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string };
const s = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : undefined);

export const Route = createFileRoute("/ingresso")({
  validateSearch: (q: Record<string, unknown>): Search => ({
    i: s(q["i"], 40),
    t: s(q["t"], 80),
    utm_source: s(q["utm_source"], 80),
    utm_medium: s(q["utm_medium"], 80),
    utm_campaign: s(q["utm_campaign"], 120),
  }),
  head: () => ({
    meta: [
      { title: "Ingresso · Palco IA News Online | FGIA Educação" },
      { name: "description", content: "Garanta seu ingresso para o Palco IA News Online, 16 de dezembro, das 19h às 20h30. Pix, cartão ou boleto." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#070B16" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/fgia/og.jpg" },
    ],
  }),
  component: FgiaCheckout,
});

type Metodo = "pix" | "cartao" | "boleto";
type Pedido = { nome: string; email: string; pago: boolean; metodo: Metodo | null; integrado: boolean };
type Pix = { imagem: string; codigo: string; expira: string | null };

const PRECO = PALCO_VALOR.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const AGENDA_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=" + encodeURIComponent("Palco IA News Online · FGIA Educação") +
  "&dates=20261216T220000Z/20261216T233000Z" +
  "&details=" + encodeURIComponent("Evento online e ao vivo com Henrique Magioni. O link de acesso chega por WhatsApp e e-mail na véspera e 2 horas antes. fgiaeducacao.com.br");

const METODOS: { id: Metodo; t: string; d: string; tag?: string }[] = [
  { id: "pix", t: "Pix", d: "Aprovação na hora. O QR Code aparece nesta página.", tag: "Mais rápido" },
  { id: "cartao", t: "Cartão de crédito", d: "Você digita o cartão na página segura do Asaas." },
  { id: "boleto", t: "Boleto", d: "Compensa em até 3 dias úteis. A vaga é confirmada depois." },
];

const INCLUI = [
  "Evento ao vivo de 1h30 com Henrique Magioni",
  "Gravação liberada por 30 dias",
  "Slides do Raio-X IA News 2026",
  "Playbook IA 2027",
  "Perguntas ao vivo na Mesa IA News",
];

const EMPTY: PalcoInput = {
  nome: "",
  empresa: "",
  cargo: "",
  whatsapp: "",
  email: "",
  papel: "",
  setor: "",
  funcionarios: "",
  desafio: "",
  consentimento: true,
};

function mascaraDoc(v: string) {
  const d = v.replace(/\D+/g, "").slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function Icone({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const I_LOCK = "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z";
const I_CHECK = "m5 12.5 4.5 4.5L19 7.5";
const I_COPY = "M9 9h11v11H9zM5 15H4V4h11v1";
const I_CAL = "M7 3v3M17 3v3M4 8h16M5 5h14v15H5z";
const I_ARROW = "M15 6l-6 6 6 6";

function FgiaCheckout() {
  const search = Route.useSearch();
  const { i, t } = search;
  const navigate = useNavigate();

  // Etapa 1: dados
  const [form, setForm] = useState<PalcoInput>(EMPTY);
  const [errors, setErrors] = useState<PalcoErrors>({});
  const [salvando, setSalvando] = useState(false);
  const [falhaDados, setFalhaDados] = useState<string | null>(null);
  const hp = useRef<HTMLInputElement>(null);
  const [passo, setPasso] = useState<"dados" | "empresa">("dados");
  const [faturamento, setFaturamento] = useState("");
  const [qErrors, setQErrors] = useState<QualificacaoErrors>({});
  const [salvo, setSalvo] = useState<{ id: string; token: string } | null>(null);

  // Etapa 2: pagamento
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [metodo, setMetodo] = useState<Metodo>("pix");
  const [doc, setDoc] = useState("");
  const [docErr, setDocErr] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<{ msg: string; url?: string } | null>(null);
  const [pix, setPix] = useState<Pix | null>(null);
  const [indo, setIndo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const topo = useRef<HTMLDivElement>(null);

  const temPedido = !!(i && t);

  const consultar = useCallback(async () => {
    if (!i || !t) return null;
    const res = await fetch(`/api/public/palco-checkout?i=${encodeURIComponent(i)}&t=${encodeURIComponent(t)}`);
    if (!res.ok) throw new Error("nao-encontrado");
    return (await res.json()) as Pedido & { ok: boolean };
  }, [i, t]);

  useEffect(() => {
    if (!temPedido) return;
    setErroCarga(false);
    consultar()
      .then((p) => {
        if (!p) return;
        setPedido(p);
        if (p.metodo) setMetodo(p.metodo);
        if (!p.pago) pixel("InitiateCheckout", { ...PALCO_PIXEL, num_items: 1 }, `checkout-${i}`);
      })
      .catch(() => setErroCarga(true));
  }, [temPedido, i, consultar]);

  // Compra confirmada: um Purchase por pedido (eventID = inscrição, deduplica com a API de Conversões).
  useEffect(() => {
    if (pedido?.pago && i) pixelOnce(`purchase-${i}`, "Purchase", { ...PALCO_PIXEL, num_items: 1 }, `purchase-${i}`);
  }, [pedido?.pago, i]);

  // Com o Pix na tela, confere o pagamento a cada 5 segundos.
  useEffect(() => {
    if (!pix || pedido?.pago) return;
    const timer = window.setInterval(() => {
      consultar()
        .then((p) => {
          if (p?.pago) setPedido((prev) => (prev ? { ...prev, pago: true } : prev));
        })
        .catch(() => null);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pix, pedido?.pago, consultar]);

  function set<K extends keyof PalcoInput>(key: K, value: PalcoInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (key in qErrors) setQErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const qualificacao = () => ({
    empresa: form.empresa,
    cargo: form.cargo,
    papel: form.papel,
    setor: form.setor,
    funcionarios: form.funcionarios,
    faturamento,
    desafio: form.desafio,
  });

  const enviarPalco = (extra: Record<string, unknown>) =>
    fetch("/api/public/palco", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        ...extra,
        checkout: "fgia",
        consentimento: true,
        empresa_site: hp.current?.value ?? "",
        origem_path: "fgiaeducacao.com.br/ingresso",
        utm_source: search.utm_source ?? "fgiaeducacao",
        utm_medium: search.utm_medium ?? "checkout",
        utm_campaign: search.utm_campaign ?? "palco-online",
        meta: metaCtx(),
      }),
    });

  function irParaPagamento(id: string, token: string) {
    navigate({ to: "/ingresso", search: (prev: Search) => ({ ...prev, i: id, t: token }), replace: true });
    topo.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // Etapa 1: grava a inscrição já com nome, WhatsApp e e-mail (o lead não se perde se a pessoa parar aqui).
  async function avancar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setFalhaDados(null);
    const { errors: found } = validatePalco(form);
    const first = (["nome", "whatsapp", "email"] as const).find((k) => found[k]);
    if (first) {
      setErrors(found);
      document.getElementById(`fgc-${first}`)?.focus();
      return;
    }
    setErrors({});
    setSalvando(true);
    try {
      const res = await enviarPalco({});
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pago?: boolean;
        error?: string;
        errors?: PalcoErrors;
        id?: string;
        token?: string;
      };
      if (res.ok && json.ok && json.id && json.token) {
        pixel("Lead", PALCO_PIXEL, `lead-${json.id}`);
        if (json.pago) {
          irParaPagamento(json.id, json.token);
          return;
        }
        setSalvo({ id: json.id, token: json.token });
        setPasso("empresa");
        pixel("ViewContent", { ...PALCO_PIXEL, content_type: "qualificacao" });
        topo.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      if (json.errors) setErrors(json.errors);
      setFalhaDados(json.error ?? (json.errors ? "Confira os campos destacados." : "Não conseguimos guardar seus dados agora. Tente de novo em instantes."));
    } catch {
      setFalhaDados("Sem conexão agora. Confira a internet e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  // Etapa 2 (opcional): a qualificação vira nota no CRM e segue para o pagamento, mesmo se a gravação falhar.
  async function salvarDados(e: FormEvent) {
    e.preventDefault();
    if (salvando || !salvo) return;
    const found = validateQualificacao(qualificacao());
    if (Object.keys(found).length) {
      setQErrors(found);
      const first = (["empresa", "cargo", "papel", "setor", "funcionarios", "faturamento"] as const).find((k) => found[k]);
      if (first) document.getElementById(`fgc-${first}`)?.focus();
      return;
    }
    setSalvando(true);
    try {
      await enviarPalco({ faturamento, qualificacao: "fgia" });
    } catch {
      // Opcional: segue para o pagamento.
    } finally {
      setSalvando(false);
    }
    irParaPagamento(salvo.id, salvo.token);
  }

  async function pagar(e: FormEvent) {
    e.preventDefault();
    if (enviando || !pedido) return;
    setFalha(null);
    setDocErr(null);
    if (pedido.integrado) {
      const d = doc.replace(/\D+/g, "");
      if (d.length !== 11 && d.length !== 14) {
        setDocErr("Informe o CPF (ou o CNPJ, se a compra for pela empresa).");
        docRef.current?.focus();
        return;
      }
    }
    setEnviando(true);
    pixel("AddPaymentInfo", { ...PALCO_PIXEL, payment_type: metodo }, `payinfo-${i}-${metodo}`);
    try {
      const res = await fetch("/api/public/palco-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ i, t, documento: doc, metodo, meta: metaCtx() }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pago?: boolean;
        modo?: "api" | "link";
        pix?: Pix;
        url?: string;
        error?: string;
        errors?: { documento?: string };
      };
      if (json.pago) {
        setPedido((p) => (p ? { ...p, pago: true } : p));
        return;
      }
      if (!res.ok || !json.ok) {
        if (json.errors?.documento) {
          setDocErr(json.errors.documento);
          docRef.current?.focus();
        } else setFalha({ msg: json.error ?? "Não conseguimos gerar o pagamento agora. Tente de novo.", url: FGIA_PAGAMENTO_URL });
        return;
      }
      if (json.pix) {
        setPix(json.pix);
        return;
      }
      const destino = json.modo === "link" ? FGIA_PAGAMENTO_URL : json.url;
      if (destino) {
        setIndo(destino);
        window.setTimeout(() => window.location.assign(destino), 1200);
      }
    } catch {
      setFalha({ msg: "Sem conexão com o pagamento agora. Tente de novo em instantes.", url: FGIA_PAGAMENTO_URL });
    } finally {
      setEnviando(false);
    }
  }

  async function copiar() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  function trocarPessoa() {
    setPedido(null);
    setPix(null);
    setErroCarga(false);
    setSalvo(null);
    setPasso("dados");
    navigate({ to: "/ingresso", search: (prev: Search) => ({ ...prev, i: undefined, t: undefined }), replace: true });
  }

  // Pix gerado, ida para o Asaas ou compra confirmada: leva o topo do cartão para a tela.
  const cartao = useRef<HTMLElement>(null);
  const fase = pedido?.pago ? "pago" : indo ? "indo" : pix ? "pix" : "";
  useEffect(() => {
    if (fase) cartao.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [fase]);

  const etapa = pedido?.pago ? 4 : temPedido ? 3 : passo === "empresa" ? 2 : 1;
  const primeiro = pedido?.nome?.trim().split(/\s+/)[0] ?? "";

  const texto = (key: "empresa" | "cargo", label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => {
    const err = qErrors[key];
    return (
      <label className="fgc-field" htmlFor={`fgc-${key}`}>
        <span>{label}</span>
        <input
          id={`fgc-${key}`}
          value={form[key]}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `fgc-${key}-err` : undefined}
          className={err ? "bad" : undefined}
          onChange={(e) => set(key, e.target.value)}
          {...props}
        />
        {err ? (
          <small className="err" id={`fgc-${key}-err`}>
            {err}
          </small>
        ) : null}
      </label>
    );
  };

  const lista = (
    key: "papel" | "setor" | "funcionarios" | "faturamento",
    label: string,
    opcoes: { v: string; l: string }[],
    valor: string,
    onChange: (v: string) => void,
    full = false,
  ) => {
    const err = qErrors[key];
    return (
      <label className={"fgc-field" + (full ? " full" : "")} htmlFor={`fgc-${key}`}>
        <span>{label}</span>
        <select
          id={`fgc-${key}`}
          value={valor}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `fgc-${key}-err` : undefined}
          className={(err ? "bad" : "") + (valor ? "" : " vazio")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Escolha
          </option>
          {opcoes.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
        {err ? (
          <small className="err" id={`fgc-${key}-err`}>
            {err}
          </small>
        ) : null}
      </label>
    );
  };

  const campo = (key: "nome" | "whatsapp" | "email", label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => {
    const err = errors[key];
    return (
      <label className="fgc-field" htmlFor={`fgc-${key}`}>
        <span>{label}</span>
        <input
          id={`fgc-${key}`}
          value={form[key]}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `fgc-${key}-err` : undefined}
          className={err ? "bad" : undefined}
          onChange={(e) => set(key, key === "whatsapp" ? maskPhone(e.target.value) : e.target.value)}
          {...props}
        />
        {err ? (
          <small className="err" id={`fgc-${key}-err`}>
            {err}
          </small>
        ) : null}
      </label>
    );
  };

  return (
    <div className="fg fgc" ref={topo}>
      <header className="fgc-top">
        <div className="fgc-wrap fgc-top-in">
          <a href={FGIA_SITE} className="fgc-logo" aria-label="FGIA Educação, voltar ao site">
            <img src="/fgia/fgia-logo.png" alt="FGIA Educação" width={900} height={102} />
          </a>
          <span className="fgc-secure">
            <Icone d={I_LOCK} size={15} /> Pagamento seguro
          </span>
        </div>
      </header>

      <main className="fgc-wrap fgc-main">
        <a href={`${FGIA_SITE}/#online`} className="fgc-back">
          <Icone d={I_ARROW} size={16} /> Voltar para o evento
        </a>

        <ol className="fgc-steps" aria-label="Etapas da compra">
          {["Seus dados", "Sua empresa", "Pagamento", "Confirmado"].map((n, k) => (
            <li key={n} className={k + 1 < etapa ? "ok" : k + 1 === etapa ? "on" : undefined} aria-current={k + 1 === etapa ? "step" : undefined}>
              <span>{k + 1 < etapa ? <Icone d={I_CHECK} size={13} /> : k + 1}</span>
              <em>{n}</em>
            </li>
          ))}
        </ol>

        <div className="fgc-grid">
          <section className="fgc-card" aria-live="polite" ref={cartao}>
            {!temPedido && passo === "dados" ? (
              <form onSubmit={avancar} noValidate>
                <p className="fgc-kick">Etapa 1 de 3</p>
                <h1 className="fgc-h1">Para quem é o ingresso?</h1>
                <p className="fgc-muted">O link de acesso e os materiais chegam no WhatsApp e no e-mail que você informar.</p>
                <div className="fgc-fields">
                  {campo("nome", "Nome completo", { autoComplete: "name", placeholder: "Seu nome e sobrenome", maxLength: 160 })}
                  {campo("whatsapp", "WhatsApp com DDD", { autoComplete: "tel-national", inputMode: "tel", placeholder: "(31) 99999-9999", maxLength: 16 })}
                  {campo("email", "E-mail", { autoComplete: "email", inputMode: "email", type: "email", placeholder: "voce@empresa.com.br", maxLength: 254 })}
                </div>
                <input ref={hp} type="text" name="empresa_site" tabIndex={-1} autoComplete="off" className="fgc-hp" aria-hidden="true" />
                <button className="fg-btn fg-btn-gold fgc-btn" type="submit" disabled={salvando}>
                  {salvando ? "Salvando…" : `Continuar · ${PRECO}`}
                </button>
                {falhaDados ? (
                  <p className="fgc-fail" role="alert">
                    {falhaDados}
                  </p>
                ) : null}
                <p className="fgc-fine">
                  Ao continuar, você aceita receber as informações do evento por WhatsApp e e-mail. Seus dados ficam só com a FGIA
                  Educação e a IA News.
                </p>
              </form>
            ) : !temPedido ? (
              <form onSubmit={salvarDados} noValidate>
                <p className="fgc-kick">Etapa 2 de 3 · opcional</p>
                <h1 className="fgc-h1">Conte sobre a sua empresa</h1>
                <p className="fgc-muted">
                  Ajuda a Mesa IA News a responder para o momento do seu negócio. Se preferir, pule e vá direto ao pagamento.
                </p>
                <button type="button" className="fgc-link fgc-skip" onClick={() => salvo && irParaPagamento(salvo.id, salvo.token)}>
                  Pular e ir para o pagamento
                </button>
                <div className="fgc-fields fgc-two">
                  {texto("empresa", "Nome da empresa", { autoComplete: "organization", placeholder: "Ex.: Clínica Vida", maxLength: 160 })}
                  {texto("cargo", "Seu cargo", { autoComplete: "organization-title", placeholder: "Ex.: Sócio, CEO, Diretor", maxLength: 120 })}
                  {lista("papel", "Você é", PAPEIS.map((p) => ({ v: p.value, l: p.label === "Empresa ou marca" ? "Empresa ou marca (quero patrocinar)" : p.label })), form.papel, (v) => set("papel", v as PalcoInput["papel"]))}
                  {lista("setor", "Segmento", SETORES.map((x) => ({ v: x, l: x })), form.setor, (v) => set("setor", v))}
                  {lista("funcionarios", "Funcionários", PORTES.map((x) => ({ v: x, l: x })), form.funcionarios, (v) => set("funcionarios", v))}
                  {lista("faturamento", "Faturamento mensal", FATURAMENTOS.map((x) => ({ v: x, l: x })), faturamento, (v) => {
                    setFaturamento(v);
                    setQErrors((prev) => ({ ...prev, faturamento: undefined }));
                  })}
                  <label className="fgc-field full" htmlFor="fgc-desafio">
                    <span>
                      O que você quer resolver com IA? <small className="opt">opcional</small>
                    </span>
                    <textarea
                      id="fgc-desafio"
                      rows={3}
                      maxLength={DESAFIO_MAX}
                      placeholder="Ex.: atender clientes no WhatsApp sem aumentar a equipe"
                      value={form.desafio}
                      onChange={(e) => set("desafio", e.target.value)}
                    />
                  </label>
                </div>
                <button className="fg-btn fg-btn-gold fgc-btn" type="submit" disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar e ir para o pagamento"}
                </button>
                <p className="fgc-fine">
                  <Icone d={I_LOCK} size={13} /> Essas informações ficam só com a FGIA Educação e a IA News e não aparecem para outros
                  participantes.
                </p>
              </form>
            ) : erroCarga ? (
              <div className="fgc-state">
                <h1 className="fgc-h1">Não encontramos este pedido</h1>
                <p className="fgc-muted">O link pode estar incompleto. Preencha seus dados de novo para gerar o pagamento.</p>
                <button type="button" className="fg-btn fg-btn-gold fgc-btn" onClick={trocarPessoa}>
                  Preencher meus dados
                </button>
              </div>
            ) : !pedido ? (
              <div className="fgc-state">
                <span className="fgc-spin" aria-hidden="true" />
                <p className="fgc-muted">Carregando seu pedido…</p>
              </div>
            ) : pedido.pago ? (
              <div className="fgc-state fgc-done">
                <span className="fgc-mark">
                  <Icone d={I_CHECK} size={32} />
                </span>
                <p className="fgc-kick">Ingresso confirmado</p>
                <h1 className="fgc-h1">Nos vemos no palco{primeiro ? `, ${primeiro}` : ""}.</h1>
                <p className="fgc-muted">
                  Pagamento aprovado. O Palco IA News Online acontece na quarta, 16 de dezembro, às 19h. O link de acesso chega no seu
                  WhatsApp e no e-mail {pedido.email}, na véspera e 2 horas antes.
                </p>
                <div className="fgc-actions">
                  <a className="fg-btn fg-btn-gold" href={AGENDA_URL} target="_blank" rel="noopener noreferrer">
                    <Icone d={I_CAL} size={17} /> Salvar na agenda
                  </a>
                  <a className="fg-btn fgc-btn-line" href={FGIA_DIRECT_URL} target="_blank" rel="noopener noreferrer">
                    Mandar uma pergunta para a Mesa
                  </a>
                </div>
              </div>
            ) : indo ? (
              <div className="fgc-state">
                <span className="fgc-spin" aria-hidden="true" />
                <h1 className="fgc-h1">Abrindo o pagamento seguro</h1>
                <p className="fgc-muted">
                  Você vai para a página do Asaas, a processadora de pagamentos, para concluir com {metodo === "boleto" ? "boleto" : "cartão"}. A
                  cobrança aparece em nome de IA NEWS LTDA.
                </p>
                <a className="fgc-link" href={indo}>
                  Não abriu? Clique aqui
                </a>
              </div>
            ) : pix ? (
              <div className="fgc-pix">
                <p className="fgc-kick">Pix gerado</p>
                <h1 className="fgc-h1">Pague com Pix para confirmar</h1>
                <p className="fgc-muted">Abra o app do seu banco, escolha Pix e leia o QR Code ou cole o código. A confirmação aparece aqui sozinha.</p>
                <div className="fgc-pix-grid">
                  <img className="fgc-qr" src={`data:image/png;base64,${pix.imagem}`} alt="QR Code do Pix" width={220} height={220} />
                  <div className="fgc-pix-side">
                    <span className="fgc-amount">{PRECO}</span>
                    <span className="fgc-muted sm">Recebedor: IA NEWS LTDA</span>
                    <label className="fgc-label" htmlFor="fgc-pix-code">
                      Pix copia e cola
                    </label>
                    <div className="fgc-copy">
                      <input id="fgc-pix-code" readOnly value={pix.codigo} onFocus={(e) => e.currentTarget.select()} />
                      <button type="button" className="fg-btn fg-btn-gold" onClick={copiar}>
                        <Icone d={copiado ? I_CHECK : I_COPY} size={16} /> {copiado ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="fgc-wait">
                  <span className="fgc-spin sm" aria-hidden="true" /> Aguardando o pagamento…
                </div>
                <button type="button" className="fgc-link" onClick={() => setPix(null)}>
                  Trocar a forma de pagamento
                </button>
              </div>
            ) : (
              <form onSubmit={pagar} noValidate>
                <p className="fgc-kick">Etapa 3 de 3</p>
                <h1 className="fgc-h1">Escolha como pagar</h1>
                <div className="fgc-who">
                  <div>
                    <small>Ingresso para</small>
                    <b>{pedido.nome}</b>
                    <span>{pedido.email}</span>
                  </div>
                  <button type="button" className="fgc-link" onClick={trocarPessoa}>
                    Não é você?
                  </button>
                </div>

                <fieldset className="fgc-methods">
                  <legend>Forma de pagamento</legend>
                  {METODOS.map((m) => (
                    <label key={m.id} className={"fgc-method" + (metodo === m.id ? " on" : "")}>
                      <input type="radio" name="metodo" value={m.id} checked={metodo === m.id} onChange={() => setMetodo(m.id)} />
                      <span className="fgc-radio" aria-hidden="true" />
                      <span className="fgc-method-txt">
                        <b>
                          {m.t} {m.tag ? <em>{m.tag}</em> : null}
                        </b>
                        <small>{m.d}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {pedido.integrado ? (
                  <label className="fgc-field" htmlFor="fgc-doc">
                    <span>CPF de quem paga</span>
                    <input
                      id="fgc-doc"
                      ref={docRef}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="000.000.000-00"
                      value={doc}
                      maxLength={18}
                      className={docErr ? "bad" : undefined}
                      aria-invalid={docErr ? true : undefined}
                      aria-describedby="fgc-doc-help"
                      onChange={(e) => {
                        setDoc(mascaraDoc(e.target.value));
                        setDocErr(null);
                      }}
                    />
                    <small id="fgc-doc-help" className={docErr ? "err" : undefined}>
                      {docErr ?? "Exigido pelo Banco Central para emitir a cobrança. Aceita CNPJ, se a compra for pela empresa."}
                    </small>
                  </label>
                ) : null}

                <button className="fg-btn fg-btn-gold fgc-btn" type="submit" disabled={enviando}>
                  {enviando ? "Gerando pagamento…" : metodo === "pix" ? `Gerar Pix de ${PRECO}` : `Pagar ${PRECO}`}
                </button>
                {falha ? (
                  <p className="fgc-fail" role="alert">
                    {falha.msg} {falha.url ? <a href={falha.url}>Pagar pelo link alternativo</a> : null}
                  </p>
                ) : null}
                <p className="fgc-fine">
                  <Icone d={I_LOCK} size={13} /> Pagamento processado pelo Asaas. A FGIA Educação não vê nem guarda dados de cartão.
                </p>
              </form>
            )}
          </section>

          <aside className="fgc-summary" aria-label="Resumo do pedido">
            <div className="fgc-event">
              <img src="/fgia/henrique.jpg" alt="Henrique Magioni, anfitrião do Palco IA News" width={724} height={905} />
              <div className="fgc-event-txt">
                <span className="fgc-live">
                  <i aria-hidden="true" /> Online e ao vivo
                </span>
                <h2>Palco IA News Online</h2>
                <p>Quarta, 16 de dezembro · 19h às 20h30</p>
                <p className="dim">Com Henrique Magioni, fundador da IA News</p>
              </div>
            </div>
            <ul className="fgc-items">
              {INCLUI.map((x) => (
                <li key={x}>
                  <Icone d={I_CHECK} size={15} /> {x}
                </li>
              ))}
            </ul>
            <div className="fgc-lines">
              <div>
                <span>1 ingresso · online</span>
                <span>{PRECO}</span>
              </div>
              <div className="fgc-total">
                <span>Total</span>
                <b>{PRECO}</b>
              </div>
            </div>
            <p className="fgc-mini">
              <b>Garantia de 7 dias</b> · gravação por 30 dias · {PRECO} viram crédito no presencial em BH
            </p>
            <div className="fgc-perks">
              <p>
                <b>Crédito em BH.</b> Os {PRECO} viram desconto no Palco presencial, em Belo Horizonte, em 11.02.27.
              </p>
              <p>
                <b>Garantia de 7 dias.</b> Desistiu depois da compra, devolvemos 100% do valor.
              </p>
            </div>
            <p className="fgc-org">
              Realização FGIA Educação e IA News. Dúvidas:{" "}
              <a href={FGIA_DIRECT_URL} target="_blank" rel="noopener noreferrer">
                Direct da @fgiaeducacao
              </a>
            </p>
          </aside>
        </div>
      </main>

      <footer className="fgc-foot">
        <div className="fgc-wrap">FGIA Educação · o palco da IA News · IA NEWS LTDA</div>
      </footer>
    </div>
  );
}
