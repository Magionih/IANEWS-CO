import { useId, useState } from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { COVER_POSITIONS, coverObjectPosition, type CoverPosition } from "@/lib/cover-position";

/* Envio da capa direto do computador, no formulário de matéria do /admin.
   No navegador: corrige a rotação (EXIF), reduz para até 1600 px de largura sem cortar nem ampliar
   e salva em JPEG 85. Depois envia ao bucket público "covers" com a sessão do administrador
   (a policy do storage só aceita admins; nenhuma chave de serviço passa pelo navegador). */

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_WIDTH = 1600;
const ACCEPT = "image/jpeg,image/png,image/webp";

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  // createImageBitmap com "from-image" aplica a orientação EXIF.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
    } catch {
      /* cai no <img>, que também respeita o EXIF nos navegadores atuais */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

async function toJpeg(file: File): Promise<Blob> {
  const { source, width, height, done } = await decode(file);
  try {
    const scale = Math.min(1, MAX_WIDTH / width); // nunca amplia
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.");
    ctx.fillStyle = "#ffffff"; // JPEG não tem transparência: fundo branco para PNG/WebP
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) throw new Error("Não foi possível gerar o JPEG.");
    return blob;
  } finally {
    done();
  }
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function CoverUpload({
  slug,
  url,
  position,
  credit,
  title,
  onUrl,
  onPosition,
  onCredit,
}: {
  slug: string;
  url: string;
  position: CoverPosition | "";
  credit: string;
  title: string;
  onUrl: (url: string) => void;
  onPosition: (p: CoverPosition | "") => void;
  onCredit: (c: string) => void;
}) {
  const fileId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setInfo(null);
    if (!file) return;
    const reset = () => setInputKey((k) => k + 1);
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Use uma imagem JPEG, PNG ou WebP.");
      return reset();
    }
    if (file.size > MAX_BYTES) {
      setError("A imagem passa de 15 MB. Escolha um arquivo menor.");
      return reset();
    }
    const s = slug.trim();
    if (!/^[a-z0-9-]{3,}$/.test(s)) {
      setError("Preencha o slug da matéria antes de enviar a capa.");
      return reset();
    }
    setBusy(true);
    try {
      const jpeg = await toJpeg(file);
      const path = `${s}/${stamp()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("covers")
        .upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (upErr) {
        const denied = /row-level security|unauthorized|403|not allowed/i.test(upErr.message);
        throw new Error(denied ? "Envio negado: só administradores podem enviar capas." : upErr.message);
      }
      const { data } = supabase.storage.from("covers").getPublicUrl(path);
      onUrl(data.publicUrl); // só troca a URL depois do envio dar certo
      setInfo(`Capa enviada (${Math.round(jpeg.size / 1024)} KB). Salve a matéria para aplicar.`);
    } catch (err) {
      setError(`Não foi possível enviar a capa: ${err instanceof Error ? err.message : "erro desconhecido"}. A URL anterior foi mantida.`);
    } finally {
      setBusy(false);
      reset();
    }
  }

  const objectPosition = coverObjectPosition(position) ?? "50% 28%";
  const hasImg = /^https?:\/\//i.test(url.trim());

  return (
    <div className="space-y-3 rounded-md border border-dashed border-input p-3">
      <div className="space-y-1.5">
        <Label htmlFor={fileId}>Enviar imagem de capa</Label>
        <div className="flex items-center gap-2">
          <Input key={inputKey} id={fileId} type="file" accept={ACCEPT} onChange={onFile} disabled={busy} className="cursor-pointer" />
          {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-label="Enviando" /> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG ou WebP até 15 MB. A imagem é ajustada para até 1600 px de largura, sem cortar.
        </p>
        <p role="status" aria-live="polite" className="text-xs">
          {error ? <span className="text-destructive">{error}</span> : info ? <span className="text-emerald-700">{info}</span> : null}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${fileId}-pos`}>Enquadramento</Label>
          <select
            id={`${fileId}-pos`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={position}
            onChange={(e) => onPosition(e.target.value as CoverPosition | "")}
          >
            <option value="">Padrão do site</option>
            {COVER_POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${fileId}-credit`}>Crédito da foto</Label>
          <Input
            id={`${fileId}-credit`}
            value={credit}
            maxLength={200}
            onChange={(e) => onCredit(e.target.value)}
            placeholder="Foto: Nome do fotógrafo/Veículo"
          />
        </div>
      </div>

      {hasImg ? (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <figure className="m-0 space-y-1">
            <span className="block overflow-hidden rounded bg-muted" style={{ aspectRatio: "16 / 9" }}>
              <img src={url} alt="" className="h-full w-full object-cover" style={{ objectPosition }} />
            </span>
            <figcaption className="text-xs text-muted-foreground">
              Topo da matéria{credit.trim() ? ` · ${credit.trim()}` : ""}
            </figcaption>
          </figure>
          <figure className="m-0 space-y-1">
            <span className="block overflow-hidden rounded bg-muted" style={{ aspectRatio: "4 / 3" }}>
              <img src={url} alt="" className="h-full w-full object-cover" style={{ objectPosition }} />
            </span>
            <figcaption className="line-clamp-2 text-xs text-muted-foreground">Card da home · {title || "Título"}</figcaption>
          </figure>
        </div>
      ) : null}
    </div>
  );
}
