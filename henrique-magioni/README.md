# Site de links · Henrique Magioni

Página única (estilo Linktree) com perfil, IA News, Sinmed, FGIA e formulário de mentoria/contato.
HTML estático, sem build: `index.html`, `obrigado.html` (página de retorno sem JavaScript) e `avatar.jpg`.

## Publicar no Netlify (igual ao sinmed.site)

1. Netlify → Add new site → **Deploy manually** → arraste esta pasta.
   (Ou conecte este repositório com *Base directory* = `henrique-magioni`.)
2. O formulário `contato` é detectado sozinho em **Forms**. Em Forms → `contato` → **Form notifications**, adicione
   um aviso por e-mail para receber cada pedido na hora.
3. Domínio: Domain management → adicione o domínio (ex.: `henriquemagioni.com`) e coloque o link na bio do
   Instagram.

## Editar

- **FGIA**: o cartão está marcado com `<!-- FGIA -->` em `index.html`; troque "Em breve." pela descrição e
  acrescente os links como nos outros cartões.
- **Foto**: troque `avatar.jpg` por uma foto quadrada de pelo menos 400×400 (a atual foi recortada da print do
  perfil e tem baixa resolução).
- **Link direto para um assunto**: `seusite.com/?assunto=Mentoria#mentoria` já abre o formulário com o assunto
  escolhido (vale para Mentoria, Sinmed, IA News, FGIA, "Palestra ou evento").
