import { useEffect, useRef, useState } from "react";

/* Foto no padrão do IANews Portal (.thumb). Sem endereço, ou se a imagem falhar,
   mostra um bloco neutro com o rótulo da editoria em vez de uma imagem quebrada. */

const IMG_OK = /^(https?:)?\/\//i;

export function ArticleThumb({
  src,
  alt,
  label,
  className,
  eager = false,
}: {
  src: string | null | undefined;
  alt: string;
  label: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const usable = Boolean(src && (IMG_OK.test(src) || src.startsWith("/")));

  useEffect(() => {
    setFailed(false);
  }, [src]);

  // Se a imagem falhou antes da hidratação, o onError não dispara: confere aqui.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);

  const cls = "thumb" + (className ? " " + className : "");
  if (!usable || failed) {
    return (
      <span className={cls + " none"}>
        <span>{label || "IANews"}</span>
      </span>
    );
  }
  return (
    <span className={cls}>
      <img
        ref={img}
        src={src!}
        alt={alt}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
