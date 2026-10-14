import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso e política de privacidade — IA News" },
      {
        name: "description",
        content:
          "Regras de uso do site IA News, tratamento de dados pessoais, cookies essenciais e de medição e direitos do titular conforme a LGPD.",
      },
      { property: "og:title", content: "Termos de uso e privacidade — IA News" },
      {
        property: "og:description",
        content: "Como o IA News trata seus dados e cookies essenciais e de medição, conforme a LGPD.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://ianews.site/termos" },
    ],
    links: [{ rel: "canonical", href: "https://ianews.site/termos" }],
  }),
  component: TermosPage,
});

const SECTIONS = [
  {
    id: "aceite",
    title: "1. Aceite dos termos",
    body: [
      "Ao navegar no IA News, criar uma conta ou assinar a newsletter, você concorda com estes termos de uso e com a política de privacidade descrita nesta página.",
      "Caso não concorde com algum ponto, pedimos que não utilize o site nem cadastre seus dados.",
    ],
  },
  {
    id: "servico",
    title: "2. O serviço",
    body: [
      "O IA News publica conteúdo jornalístico e analítico sobre inteligência artificial, incluindo matérias, rankings e uma edição diária por e-mail.",
      "O conteúdo tem finalidade informativa e não constitui aconselhamento jurídico, financeiro ou de investimento. Decisões tomadas com base nas publicações são de responsabilidade do leitor.",
    ],
  },
  {
    id: "conta",
    title: "3. Conta do leitor",
    body: [
      "A criação de conta é gratuita e exige nome, e-mail e telefone. Você é responsável por manter a confidencialidade da sua senha e por toda atividade realizada na sua conta.",
      "Podemos suspender contas que violem estes termos, pratiquem uso automatizado abusivo ou tentem acessar áreas restritas.",
    ],
  },
  {
    id: "dados",
    title: "4. Dados que coletamos",
    body: [
      "Dados de cadastro: nome, e-mail e telefone informados por você no cadastro, na assinatura da newsletter ou nos formulários de contato e de mídia.",
      "Dados de leitura: matérias abertas, tempo de leitura, rolagem e conclusão, usados para alimentar a área Meus Hábitos e para melhorar a curadoria editorial.",
      "Dados técnicos: informações de dispositivo e navegação geradas automaticamente durante o acesso.",
    ],
  },
  {
    id: "uso",
    title: "5. Como usamos os dados",
    body: [
      "Para entregar o serviço: exibir seu histórico de leitura, metas e enviar a edição diária que você solicitou.",
      "Para comunicação: responder mensagens enviadas pelas páginas de Contato e Anuncie e tratar propostas comerciais.",
      "Para melhoria editorial: entender quais temas geram mais valor para a audiência, sempre de forma agregada.",
      "Não vendemos seus dados pessoais a terceiros.",
    ],
  },
  {
    id: "cookies",
    title: "6. Cookies essenciais e de medição",
    body: [
      "Utilizamos cookies essenciais para manter a sessão autenticada e cookies de medição para entender o desempenho do conteúdo.",
      "Ao acessar o site pela primeira vez, você pode escolher 'Só essenciais' ou aceitar também os cookies de medição. Você pode rever essa escolha a qualquer momento em 'Preferências de cookies', no rodapé.",
      "Bloquear cookies no navegador não impede o acesso ao conteúdo do site.",
    ],
  },
  {
    id: "menores",
    title: "7. Menores de idade",
    body: [
      "O IA News é um veículo de conteúdo profissional, dirigido a maiores de 18 anos. Não é destinado a crianças e não coletamos intencionalmente dados de menores de 13 anos.",
      "Se identificarmos cadastro de menor de idade sem consentimento dos responsáveis, os dados são excluídos.",
    ],
  },
  {
    id: "direitos",
    title: "8. Seus direitos (LGPD)",
    body: [
      "Você pode solicitar a confirmação do tratamento, o acesso, a correção, a portabilidade, a anonimização ou a exclusão dos seus dados pessoais, além de revogar o consentimento a qualquer momento.",
      "Todo e-mail da newsletter traz um link de descadastro. Pedidos relacionados a dados podem ser enviados pela página de Contato.",
    ],
  },
  {
    id: "seguranca",
    title: "9. Segurança e retenção",
    body: [
      "Os dados ficam armazenados em infraestrutura com controle de acesso por perfil e regras de segurança por linha, de modo que cada leitor só acessa as próprias informações.",
      "Mantemos os dados enquanto a conta existir ou enquanto houver relação de comunicação ativa, salvo obrigação legal de guarda por prazo maior.",
    ],
  },
  {
    id: "propriedade",
    title: "10. Propriedade intelectual e uso de fontes",
    body: [
      "As matérias, análises, marca e identidade visual do IA News são protegidas por direitos autorais. É permitida a citação de trechos curtos com atribuição e link para a página original.",
      "A reprodução integral de conteúdo, com ou sem fins comerciais, depende de autorização prévia.",
      "Não republicamos conteúdo de terceiros: nossas matérias são escritas pela redação, com análise própria e atribuição em link às fontes consultadas. Notificações de suposta violação de direitos autorais podem ser enviadas pela página de Contato e são tratadas em até 48 horas.",
    ],
  },
  {
    id: "alteracoes",
    title: "11. Alterações e contato",
    body: [
      "Estes termos podem ser atualizados para refletir mudanças no serviço ou na legislação. A data da última atualização é sempre exibida no topo desta página.",
      "Dúvidas sobre termos, privacidade ou tratamento de dados: use a página de Contato.",
    ],
  },
];

function TermosPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Legal</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">
          Termos de uso &amp; Privacidade
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Última atualização em{" "}
          {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}. Este
          documento explica as regras de uso do IA News e como tratamos seus dados pessoais.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Índice" className="hidden lg:block">
            <div className="sticky top-28 space-y-2">
              <p className="font-mono-eyebrow text-muted-foreground">Nesta página</p>
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-muted-foreground hover:text-[color:var(--color-lime)]"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </nav>

          <div className="max-w-3xl space-y-10">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{s.title}</h2>
                <div className="mt-3 space-y-3">
                  {s.body.map((p) => (
                    <p key={p} className="text-muted-foreground">
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}