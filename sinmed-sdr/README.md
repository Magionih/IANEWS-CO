# Agente SDR de remarketing · Sinmed

Lê as conversas de prospecção da Sinmed (Instagram @sinmed.co, WhatsApp Business com a etiqueta **SimMed** e as
planilhas dos lotes), descobre por que cada clínica respondeu ou não, e prepara para cada uma um remarketing
individual: diagnóstico, objeção a quebrar, estratégia, mensagem pronta assinada pela Renata, próximo toque e a data
certa para enviar sem estourar o limite das contas.

O agente **não envia nada sozinho**. A conta comercial já foi restrita por envio em sequência; por isso ele monta
uma fila com no máximo 10 envios por dia por canal, e a Renata envia um a um pelo painel (botão que abre o WhatsApp
com o texto já preenchido, ou a DM do Instagram).

## Como funciona, de ponta a ponta

```
exportações (WhatsApp .txt/.zip, Instagram .json, planilhas .xlsx/.csv)
   │
   ▼  leitores.py      junta o mesmo contato vindo de fontes diferentes (telefone, @perfil, nome)
   ▼  pre_analise.py   fatos sem interpretação: quem falou por último, tentativas sem resposta,
   │                   resposta automática, porteira, proposta enviada, pedido de saída, etapa da cadência
   ▼  analista.py      Claude lê o playbook + fatos + conversa inteira e devolve, em JSON validado:
   │                   situação, motivo, evidências, objeções, temperatura, score, estratégia,
   │                   mensagem, roteiro de ligação e próximo toque
   ▼  revisor.py       regras fixas da marca (sem "IA/robô/chatbot", assinatura da Renata, sem link na
   │                   1ª mensagem, sem número sem fonte, preço só da tabela...). Reprovou → Claude reescreve
   ▼  fila.py          prioriza (quem está esperando NOSSA resposta primeiro), respeita 10/dia/canal,
   │                   intervalo de 30 min, dias úteis 8h–20h e a cadência
   ▼  saida/           painel.html · fila_envio.csv · relatorio.md · analise_completa.json
```

Regras que o código garante (a análise não consegue contrariar):

- pediu para sair → nunca mais recebe mensagem;
- cadência do livro da marca: mensagem 1 → +2 dias → +5 dias → parar; depois disso, **uma** reativação estratégica
  após 21 dias, com ângulo novo; sem resposta, encerra;
- proposta enviada: retomadas em +2, +5 e +10 dias, depois uma reativação;
- resposta automática da clínica não conta como resposta (a mensagem provavelmente nunca chegou ao decisor);
- quando a clínica falou por último e ninguém respondeu, o contato vai para o topo da fila.

O conhecimento do negócio (oferta, preços, ICP, personas, objeções, tom de voz, aprendizados da prospecção) fica em
[`conhecimento/playbook.md`](conhecimento/playbook.md). Mudou preço, oferta ou objeção? Edite só esse arquivo.

## 1. Exportar os dados

Coloque tudo em `sinmed-sdr/dados/` (a pasta está no `.gitignore`: conversas reais nunca vão para o git).

**WhatsApp Business (etiqueta SimMed)** — `dados/whatsapp/`
1. No app, em Conversas, filtre pela etiqueta **SimMed**.
2. Abra cada conversa → ⋮ → Mais → **Exportar conversa** → **Sem mídia**.
3. Salve o `.txt` (ou o `.zip`) na pasta. Toda conversa nessa pasta é tratada como etiquetada SimMed.

O WhatsApp não exporta as etiquetas, por isso a seleção é feita no filtro do app. Inclua as conversas em que já
foi enviada proposta.

**Instagram @sinmed.co** — `dados/instagram/`
1. Instagram → Configurações → Central de Contas → Suas informações e permissões → **Baixar suas informações**.
2. Escolha só **Mensagens**, formato **JSON**, período desde o início da prospecção.
3. Quando chegar o e-mail, descompacte e copie a pasta `your_instagram_activity/messages/inbox` (ou `messages/inbox`)
   para `dados/instagram/`.

**Planilhas dos lotes** — `dados/planilhas/`
Copie `prospeccao-clinicas-bh-lote-N.xlsx` e `prospeccao-instagram-clinicas-bh.xlsx`. As colunas são reconhecidas
pelo nome (clínica/nome, telefone/WhatsApp, Instagram, status/resultado, data, lote, observações). Contatos que só
existem na planilha também entram: os "Pendente"/"Não enviado" recebem a mensagem 1; os "Enviado" seguem a cadência.

Se o nome da Renata no WhatsApp ou o nome da conta no Instagram for diferente, ajuste `config.json`
(`nossos_nomes`), para o agente saber quais mensagens são nossas.

## 2. Rodar

```bash
cd sinmed-sdr
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=...        # ou `ant auth login`

python -m sinmed_sdr analisar                  # analisa todos os contatos com o Claude
python -m sinmed_sdr analisar --so integra     # só contatos cujo nome contém "integra"
python -m sinmed_sdr analisar --sem-ia         # sem API: regras + mensagens de modelo (mais raso)
```

Opções: `--limite-dia 10` (envios por dia por canal), `--paralelos 4`, `--hoje 2026-10-20T09:00` (simular outra
data), `--dados` e `--saida` (outras pastas).

Custo: uma chamada por contato (duas quando o revisor pede reescrita), com o playbook em cache. O modelo é o
`claude-opus-5-5` com raciocínio adaptativo e esforço alto; para trocar, edite `MODELO` em `sinmed_sdr/analista.py`.

Sem chave da API, dá para pedir ao Claude Code: "rode o remarketing da Sinmed". A skill
`.claude/skills/sinmed-sdr` prepara os fatos, faz a análise na própria conversa e gera a mesma fila.

## 3. Usar o resultado

- **`saida/painel.html`** — abra no navegador do computador ou do celular. Um cartão por envio, agrupado por dia,
  com o texto pronto, botão **Copiar texto**, botão que abre o WhatsApp já com a mensagem (ou a DM do Instagram) e
  a caixa "enviado" para marcar o que já saiu.
- **`saida/relatorio.md`** — o quadro geral (situação, motivos, objeções) e, contato a contato: diagnóstico,
  evidências, estratégia, mensagem, roteiro de ligação e próximo toque.
- **`saida/fila_envio.csv`** — a mesma fila para abrir no Excel/Sheets.
- **`saida/analise_completa.json`** — tudo, para auditoria ou para reprocessar.

Editou uma mensagem ou mudou uma ação no `analise_completa.json`? Refaça a revisão, a fila e os relatórios sem
chamar a API de novo:

```bash
python -m sinmed_sdr fila
```

Rotina sugerida: exportar e rodar toda segunda e quinta de manhã; enviar os cartões do dia respeitando os horários;
o que responder sai da cadência automaticamente na próxima rodada.

## Dados de exemplo

`exemplos/` tem conversas e planilhas **fictícias** para testar: `python -m sinmed_sdr analisar --sem-ia --dados
exemplos --saida /tmp/teste-sinmed`.

## LGPD e cuidados

- São contatos comerciais de clínicas (B2B), mas continuam sendo dados pessoais: `dados/` e `saida/` ficam fora do
  git; apague as exportações quando não precisar mais delas.
- Só o texto das conversas comerciais é enviado para análise. Não exporte conversas com pacientes.
- Mensagens só para quem não pediu para sair; envio manual, individual, em dia útil, entre 8h e 20h.
