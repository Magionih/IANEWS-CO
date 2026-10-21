/* Caixa de consentimento para entrar na newsletter a partir de formulários de contato. */
export function NewsletterOptIn() {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.45, color: "var(--p-ink-2)", cursor: "pointer", margin: "4px 0 2px" }}>
      <input type="checkbox" name="newsletter" style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--p-blue)" }} />
      <span>Quero receber a newsletter diária da IANews, grátis, todo dia às 7h.</span>
    </label>
  );
}

/** Lê a caixa de consentimento do formulário (chamar antes de qualquer await). */
export function wantsNewsletter(e: { currentTarget: EventTarget | null }): boolean {
  const form = e.currentTarget instanceof HTMLFormElement ? e.currentTarget : null;
  return form ? new FormData(form).get("newsletter") === "on" : false;
}
