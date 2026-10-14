import { useState } from "react";

import { Input } from "@/components/ui/input";
import { emailSuggestions, formatPhoneBR } from "@/lib/form-format";

type PhoneProps = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
};

/** Telefone com máscara brasileira automática: (11) 99999-0000 */
export function PhoneInput({ value, onChange, className }: PhoneProps) {
  return (
    <Input
      type="tel"
      inputMode="numeric"
      maxLength={16}
      value={value}
      onChange={(e) => onChange(formatPhoneBR(e.target.value))}
      placeholder="(11) 99999-0000"
      aria-label="Seu telefone"
      className={className}
    />
  );
}

type EmailProps = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** Cor do painel de sugestões: escuro (padrão) ou claro */
  tone?: "dark" | "light";
};

/** E-mail com sugestão automática de domínios ao digitar "@" */
export function EmailInput({ value, onChange, className, tone = "dark" }: EmailProps) {
  const [focused, setFocused] = useState(false);
  const suggestions = focused ? emailSuggestions(value) : [];

  return (
    <div className="relative">
      <Input
        type="email"
        required
        maxLength={255}
        autoComplete="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        placeholder="voce@empresa.com"
        aria-label="Seu e-mail"
        className={className}
      />
      {suggestions.length > 0 && (
        <ul
          className={
            tone === "dark"
              ? "absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-auto border border-white/15 bg-[color:var(--color-nav)] text-sm text-white shadow-xl"
              : "absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-auto border border-border bg-background text-sm text-foreground shadow-xl"
          }
        >
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s);
                  setFocused(false);
                }}
                className={
                  tone === "dark"
                    ? "block w-full px-4 py-2 text-left hover:bg-white/10"
                    : "block w-full px-4 py-2 text-left hover:bg-muted"
                }
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
