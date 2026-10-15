import { useState } from "react";

/* "Compartilhar": copiar link (como no protótipo) e enviar pelo WhatsApp. */

export function ArticleShare({ url, title }: { url: string; title: string }) {
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMsg({ t: "Link copiado.", ok: true });
    } catch {
      setMsg({ t: "O navegador bloqueou a cópia.", ok: false });
    }
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;

  return (
    <div className="box">
      <h3>Compartilhar</h3>
      <button type="button" className="btn line s" onClick={copy}>
        Copiar link da matéria
      </button>
      <a className="btn line s" href={wa} target="_blank" rel="noreferrer noopener">
        Enviar pelo WhatsApp
      </a>
      <p
        className={"msg" + (msg ? (msg.ok ? " ok" : " err") : "")}
        role="status"
        aria-live="polite"
      >
        {msg?.t ?? ""}
      </p>
    </div>
  );
}
