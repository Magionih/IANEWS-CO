/* Capas em tamanho certo: as imagens do bucket "covers" do Supabase passam pelo
   redimensionamento do próprio Supabase (WebP quando o navegador aceita).
   Endereços de fora seguem como estão. */
const MARK = "/storage/v1/object/public/";
const WIDTHS = [320, 640, 960, 1280];

function render(url: string, w: number): string {
  return (
    url.replace(MARK, "/storage/v1/render/image/public/") + `?width=${w}&quality=72&resize=contain`
  );
}

export function isResizable(url: string | null | undefined): url is string {
  return !!url && url.includes(MARK) && /\.supabase\.co\//.test(url) && !url.includes("?");
}

/** src padrão (até `max` px) e srcset para o navegador escolher. */
export function coverImg(
  url: string | null | undefined,
  max = 960,
): { src?: string; srcSet?: string } {
  if (!url) return {};
  if (!isResizable(url)) return { src: url };
  const ws = WIDTHS.filter((w) => w <= max);
  return { src: render(url, max), srcSet: ws.map((w) => `${render(url, w)} ${w}w`).join(", ") };
}
