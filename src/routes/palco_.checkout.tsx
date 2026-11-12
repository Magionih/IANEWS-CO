import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PALCO_PIXEL, metaCtx, pixel, pixelOnce } from "@/lib/pixel";

import logoWhite from "@/assets/ianews-logo-white.png";
import { CONTACT_EMAIL } from "@/lib/pauta-validate";
import { PALCO_PAGAMENTO_URL, PALCO_VALOR } from "@/lib/palco-validate";

/* Checkout do Palco IA News Online: a pessoa chega aqui depois da inscrição em /palco, escolhe Pix, cartão ou
   boleto e paga sem sair da identidade da IA News. O Pix aparece na própria página (QR e copia e cola) e a vaga
   é confirmada sozinha; cartão e boleto seguem para a fatura segura do Asaas. Fala com /api/public/palco-checkout. */

type Search = { i?: string; t?: string };

export const Route = createFileRoute("/palco_/checkout")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    i: typeof s["i"] === "string" ? s["i"].slice(0, 40) : undefined,
    t: typeof s["t"] === "string" ? s["t"].slice(0, 80) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pagamento · Palco IA News Online | IA News" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutPage,
});

type Metodo = "pix" | "cartao" | "boleto";
type Pedido = { nome: string; email: string; pago: boolean; metodo: Metodo | null; integrado: boolean };
type Pix = { imagem: string; codigo: string; expira: string | null };

const PRECO = PALCO_VALOR.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const IMG = "https://images.pexels.com/photos/20733081/pexels-photo-20733081.jpeg?auto=compress&cs=tinysrgb&w=900";
const AGENDA_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=" + encodeURIComponent("Palco IA News Online") +
  "&dates=20261216T220000Z/20261216T233000Z" +
  "&details=" + encodeURIComponent("Workshop ao vivo da IA News. O link de acesso chega por WhatsApp e e-mail na véspera e 2 horas antes. ianewsbr.com/palco");

const METODOS: { id: Metodo; t: string; d: string; tag?: string }[] = [
  { id: "pix", t: "Pix", d: "Aprovação na hora. O QR aparece aqui mesmo.", tag: "Mais rápido" },
  { id: "cartao", t: "Cartão de crédito", d: "Você digita o cartão na página segura do Asaas." },
  { id: "boleto", t: "Boleto", d: "Compensa em até 3 dias úteis. A vaga é confirmada depois." },
];

const INCLUI = ["Workshop ao vivo de 1h30", "Gravação por 30 dias", "Slides do Raio-X IA News 2026", "Playbook IA 2027"];

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

function CheckoutPage() {
  const { i, t } = Route.useSearch();
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

  const consultar = useCallback(async () => {
    if (!i || !t) return null;
    const res = await fetch(`/api/public/palco-checkout?i=${encodeURIComponent(i)}&t=${encodeURIComponent(t)}`);
    if (!res.ok) throw new Error("nao-encontrado");
    return (await res.json()) as Pedido & { ok: boolean };
  }, [i, t]);

  useEffect(() => {
    if (!i || !t) {
      setErroCarga(true);
      return;
    }
    consultar()
      .then((p) => {
        if (!p) return;
        setPedido(p);
        if (p.metodo) setMetodo(p.metodo);
        if (!p.pago) pixel("InitiateCheckout", { ...PALCO_PIXEL, num_items: 1 }, `checkout-${i}`);
      })
      .catch(() => setErroCarga(true));
  }, [i, t, consultar]);

  // Compra confirmada: um Purchase por pedido (eventID = inscrição, para deduplicar com a API de Conversões).
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

  async function pagar(e: FormEvent) {
    e.preventDefault();
    if (enviando || !pedido) return;
    setFalha(null);
    setDocErr(null);
    if (pedido.integrado) {
      const d = doc.replace(/\D+/g, "");
      if (d.length !== 11 && d.length !== 14) {
        setDocErr("Informe o CPF (ou o CNPJ, se a nota for para a empresa).");
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
        } else setFalha({ msg: json.error ?? "Não conseguimos gerar o pagamento agora. Tente de novo.", url: json.url });
        return;
      }
      if (json.pix) {
        setPix(json.pix);
        return;
      }
      if (json.url) {
        setIndo(json.url);
        window.setTimeout(() => window.location.assign(json.url!), 1200);
      }
    } catch {
      setFalha({ msg: "Sem conexão com o pagamento agora. Tente de novo em instantes.", url: PALCO_PAGAMENTO_URL });
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

  const etapa = pedido?.pago ? 4 : 2;
  const primeiro = pedido?.nome?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="ck">
      <header className="ck-top">
        <div className="ck-wrap ck-top-in">
          <Link to="/palco" className="ck-logo" aria-label="Voltar para o Palco IA News">
            <img src={logoWhite} alt="IA News" width={795} height={160} />
          </Link>
          <span className="ck-secure">
            <Icone d={I_LOCK} size={16} /> Pagamento seguro
          </span>
        </div>
      </header>

      <main className="ck-wrap ck-main">
        <ol className="ck-steps" aria-label="Etapas">
          {["Inscrição", "Pagamento", "Vaga confirmada"].map((s, n) => (
            <li key={s} className={n + 1 < etapa ? "ok" : n + 1 === etapa ? "on" : undefined} aria-current={n + 1 === etapa ? "step" : undefined}>
              <span>{n + 1 < etapa ? <Icone d={I_CHECK} size={14} /> : n + 1}</span>
              {s}
            </li>
          ))}
        </ol>

        <div className="ck-grid">
          <section className="ck-card ck-pay" aria-live="polite">
            {erroCarga ? (
              <div className="ck-state">
                <h1>Não encontramos este pedido</h1>
                <p>O link pode estar incompleto. Faça a inscrição de novo, ou fale com a gente em {CONTACT_EMAIL}.</p>
                <Link className="btn blue ck-btn" to="/palco">
                  Voltar para o Palco IA News
                </Link>
              </div>
            ) : !pedido ? (
              <div className="ck-state ck-loading">
                <span className="ck-spin" aria-hidden="true" />
                <p>Carregando seu pedido…</p>
              </div>
            ) : pedido.pago ? (
              <div className="ck-state ck-done">
                <span className="ck-done-mark">
                  <Icone d={I_CHECK} size={34} />
                </span>
                <h1>Vaga confirmada{primeiro ? `, ${primeiro}` : ""}!</h1>
                <p>
                  Seu pagamento foi aprovado. Nos vemos no Palco IA News Online, quarta, 16 de dezembro, às 19h. O link de
                  acesso chega pelo WhatsApp e pelo e-mail {pedido.email}, na véspera e 2 horas antes.
                </p>
                <div className="ck-done-actions">
                  <a className="btn blue ck-btn" href={AGENDA_URL} target="_blank" rel="noopener noreferrer">
                    Adicionar à agenda
                  </a>
                  <Link className="btn line ck-btn" to="/palco">
                    Ver a programação
                  </Link>
                </div>
              </div>
            ) : indo ? (
              <div className="ck-state ck-loading">
                <span className="ck-spin" aria-hidden="true" />
                <h1>Abrindo o pagamento seguro</h1>
                <p>
                  Você vai para a página do Asaas, a processadora de pagamentos da IA News, para concluir com{" "}
                  {metodo === "boleto" ? "boleto" : "cartão"}. A cobrança aparece em nome de IA NEWS LTDA.
                </p>
                <a className="ck-link" href={indo}>
                  Não abriu? Clique aqui
                </a>
              </div>
            ) : pix ? (
              <div className="ck-pix">
                <h1>Pague com Pix para confirmar</h1>
                <p className="ck-muted">Abra o app do seu banco, escolha Pix e leia o QR ou cole o código. A confirmação aparece aqui sozinha.</p>
                <div className="ck-pix-grid">
                  <img className="ck-qr" src={`data:image/png;base64,${pix.imagem}`} alt="QR Code do Pix" width={220} height={220} />
                  <div className="ck-pix-side">
                    <span className="ck-amount">{PRECO}</span>
                    <span className="ck-muted">Recebedor: IA NEWS LTDA</span>
                    <label className="ck-label" htmlFor="ck-pix-code">
                      Pix copia e cola
                    </label>
                    <div className="ck-copy">
                      <input id="ck-pix-code" readOnly value={pix.codigo} onFocus={(e) => e.currentTarget.select()} />
                      <button type="button" className="btn blue" onClick={copiar}>
                        <Icone d={copiado ? I_CHECK : I_COPY} size={16} /> {copiado ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="ck-wait">
                  <span className="ck-spin sm" aria-hidden="true" /> Aguardando o pagamento…
                </div>
                <button type="button" className="ck-link" onClick={() => setPix(null)}>
                  Trocar a forma de pagamento
                </button>
              </div>
            ) : (
              <form onSubmit={pagar} noValidate>
                <h1>Finalize sua inscrição</h1>
                <div className="ck-who">
                  <div>
                    <small>Participante</small>
                    <b>{pedido.nome}</b>
                    <span>{pedido.email}</span>
                  </div>
                  <Link to="/palco" className="ck-link">
                    Não é você?
                  </Link>
                </div>

                <fieldset className="ck-methods">
                  <legend>Forma de pagamento</legend>
                  {METODOS.map((m) => (
                    <label key={m.id} className={"ck-method" + (metodo === m.id ? " on" : "")}>
                      <input type="radio" name="metodo" value={m.id} checked={metodo === m.id} onChange={() => setMetodo(m.id)} />
                      <span className="ck-radio" aria-hidden="true" />
                      <span className="ck-method-txt">
                        <b>
                          {m.t} {m.tag ? <em>{m.tag}</em> : null}
                        </b>
                        <small>{m.d}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {pedido.integrado ? (
                  <label className="ck-field" htmlFor="ck-doc">
                    <span>CPF do pagador</span>
                    <input
                      id="ck-doc"
                      ref={docRef}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="000.000.000-00"
                      value={doc}
                      maxLength={18}
                      aria-invalid={docErr ? true : undefined}
                      aria-describedby="ck-doc-help"
                      onChange={(e) => {
                        setDoc(mascaraDoc(e.target.value));
                        setDocErr(null);
                      }}
                    />
                    <small id="ck-doc-help" className={docErr ? "err" : undefined}>
                      {docErr ?? "Exigido pelo Banco Central para emitir a cobrança. Aceita CNPJ, se for pela empresa."}
                    </small>
                  </label>
                ) : null}

                <button className="btn blue ck-btn ck-pay-btn" type="submit" disabled={enviando}>
                  {enviando ? "Gerando pagamento…" : metodo === "pix" ? `Gerar Pix de ${PRECO}` : `Pagar ${PRECO}`}
                </button>
                {falha ? (
                  <p className="ck-fail" role="alert">
                    {falha.msg}{" "}
                    {falha.url ? (
                      <a href={falha.url}>Pagar pelo link alternativo</a>
                    ) : null}
                  </p>
                ) : null}
                <p className="ck-fine">
                  <Icone d={I_LOCK} size={14} /> Pagamento processado pelo Asaas. A IA News não vê nem guarda dados de cartão.
                </p>
              </form>
            )}
          </section>

          <aside className="ck-card ck-summary" aria-label="Resumo do pedido">
            <div className="ck-event">
              <img src={IMG} alt="" width={900} height={600} />
              <div>
                <span className="ck-live">
                  <i aria-hidden="true" /> Online e ao vivo
                </span>
                <h2>Palco IA News Online</h2>
                <p>Quarta, 16 de dezembro · 19h às 20h30</p>
              </div>
            </div>
            <ul className="ck-items">
              {INCLUI.map((x) => (
                <li key={x}>
                  <Icone d={I_CHECK} size={15} /> {x}
                </li>
              ))}
            </ul>
            <div className="ck-lines">
              <div>
                <span>Ingresso</span>
                <span>{PRECO}</span>
              </div>
              <div className="ck-total">
                <span>Total</span>
                <b>{PRECO}</b>
              </div>
            </div>
            <p className="ck-bonus">Os {PRECO} viram desconto no Palco presencial, em Belo Horizonte, em fevereiro de 2027.</p>
            <p className="ck-bonus">Garantia de 7 dias: desistiu depois da compra, devolvemos 100% do valor.</p>
            <p className="ck-org">
              Realização IA News e FGIA Educação. Dúvidas: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
