import { coverObjectPosition } from "@/lib/cover-position";
import { useEffect, useRef, useState } from "react";
import { coverImg, isResizable } from "@/lib/img";

/* Foto no padrão do IANews Portal (.thumb). Sem endereço, ou se a imagem falhar,
   mostra um bloco neutro com o rótulo da editoria em vez de uma imagem quebrada. */

const IMG_OK = /^(https?:)?\/\//i;

export function ArticleThumb({
  src,
  alt,
  label,
  className,
  eager = false,
  position,
}: {
  src: string | null | undefined;
  alt: string;
  label: string;
  className?: string;
  eager?: boolean;
  position?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const [orig, setOrig] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const small = !!className && /r43|r32/.test(className);
  const pic = orig ? { src: src ?? undefined } : coverImg(src, small ? 640 : 1280);
  const sizes = small ? "(max-width: 640px) 140px, 240px" : "(max-width: 900px) 100vw, 820px";
  const usable = Boolean(src && (IMG_OK.test(src) || src.startsWith("/")));

  useEffect(() => {
    setFailed(false);
    setOrig(false);
  }, [src]);

  // Se a imagem falhou antes da hidratação, o onError não dispara: confere aqui.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) {
      if (!orig && isResizable(src)) setOrig(true);
      else setFailed(true);
    }
  }, [src, orig]);

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
        style={position ? { objectPosition: coverObjectPosition(position) } : undefined}
        ref={img}
        src={pic.src}
        srcSet={pic.srcSet}
        sizes={pic.srcSet ? sizes : undefined}
        alt={alt}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        onError={() => (!orig && isResizable(src) ? setOrig(true) : setFailed(true))}
      />
    </span>
  );
}
