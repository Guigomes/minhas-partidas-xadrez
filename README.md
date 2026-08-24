# Minhas Partidas de Xadrez

Site pessoal para registrar minhas partidas de xadrez, com estatísticas públicas (vitórias, derrotas, empates, taxa de aproveitamento) e um painel de administração para adicionar, editar e remover partidas.

Baseado na mesma stack e estrutura do projeto [`confirmar-presenca-miguel-front`](https://github.com/guigomes/confirmar-presenca-miguel-front).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Next.js 15 (App Router) + TypeScript |
| Estilo | Tailwind CSS |
| Estado / cache | TanStack Query v5 |
| Backend | Firebase (Firestore + Authentication) |
| Formulários | React Hook Form + Zod |
| Deploy | Vercel |

---

## Funcionalidades

### Públicas
- Página inicial com estatísticas (partidas, vitórias, derrotas, empates, taxa de aproveitamento)
- Lista de partidas registradas (adversário, resultado, cor, controle de tempo, abertura, notas)
- Filtros na lista de partidas: por tipo (Torneio / Lichess / Chess.com / Manual), por origem (de onde a partida foi importada), por período (data inicial/final) e busca por nome do adversário
- Gráficos de estatísticas: resultados (parte-todo), desempenho por cor e evolução da taxa de aproveitamento ao longo dos meses, com tooltip ao passar o mouse e tabela alternativa
- Tabuleiro navegável para revisar o PGN lance a lance
- Modo escuro / claro

### Administrativas
- Login do administrador com Google
- Registro de novas partidas (formulário)
- **Importação automática** do Lichess e do Chess.com (por nome de usuário), de um torneio do Chess-Results (pela URL da ficha do jogador), ou de **todos os torneios de um jogador pelo ID da CBX** (cruza automaticamente com o chess-results) — com prévia e sem duplicar o que já foi importado
- Edição e remoção de partidas na lista

---

## Setup local

### 1. Pré-requisitos

- Node.js 20+
- Projeto no [Firebase](https://console.firebase.google.com) (plano gratuito Spark funciona)

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar o Firebase

1. Em **Authentication → Sign-in method**, ative o provedor **Google**.
2. Em **Firestore Database**, crie o banco (modo produção).
3. Em **Firestore Database → Regras**, cole o conteúdo de [`firestore.rules`](./firestore.rules).
4. Em **Project Settings → Seus apps → SDK setup**, copie as chaves do app web.

### 4. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com os valores do seu projeto Firebase:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> Essas chaves do app web são públicas por design — a segurança de verdade está nas regras do Firestore (`firestore.rules`), não nessas chaves.

### 5. Liberar o acesso de administrador

1. Abra `lib/config/admins.ts` e coloque o(s) e-mail(s) Google que devem ter acesso ao painel.
2. Copie a mesma lista para `firestore.rules` (função `isAdmin()`) — precisam ficar idênticas — e cole o arquivo atualizado nas regras do Firestore no console.

### 6. Editar os dados exibidos no site

Edite `lib/config/player.ts` com o seu nome e o título do site.

### 7. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Estrutura do projeto

```
minhas-partidas-xadrez/
├── app/
│   ├── layout.tsx                  # Root layout + Providers
│   ├── page.tsx                    # Home + estatísticas + lista pública de partidas
│   ├── not-found.tsx
│   ├── error.tsx
│   ├── providers.tsx               # TanStack Query provider
│   ├── login/page.tsx              # "Entrar com Google"
│   ├── admin/
│   │   ├── layout.tsx              # Guard de autenticação (client-side)
│   │   └── page.tsx                # Painel: importar + formulário + resumo + lista
│   └── api/
│       └── import/route.ts         # Rota serverless que busca partidas nos provedores
│
├── components/
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   └── admin-sign-out.tsx
│   ├── ui/
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── empty-state.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   ├── spinner.tsx
│   │   └── theme-toggle.tsx
│   └── matches/
│       ├── match-form.tsx
│       ├── match-import.tsx        # UI de importação (Lichess / Chess.com / Chess-Results / CBX)
│       ├── match-summary.tsx
│       ├── match-charts.tsx
│       └── match-table.tsx
│
├── lib/
│   ├── firebase/
│   │   └── client.ts                # Firebase App/Auth/Firestore init
│   ├── import/
│   │   ├── lichess.ts               # Busca + normalização de partidas do Lichess
│   │   ├── chesscom.ts              # Busca + normalização de partidas do Chess.com
│   │   ├── chessresults.ts          # Busca por URL de torneio (art=9) + fetch por tnr/snr
│   │   ├── chessresults-search.ts   # Busca de torneios por data + resolução de snr por nome (art=1)
│   │   ├── cbx.ts                   # Ficha de torneios na CBX + orquestração do cruzamento com o chess-results
│   │   └── html-entities.ts         # Decodificador de entidades HTML compartilhado
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-import.ts            # Hook que chama /api/import
│   │   └── use-matches.ts           # CRUD + gravação em lote (importação)
│   ├── utils/
│   │   ├── cn.ts
│   │   └── date.ts
│   └── config/
│       ├── player.ts                # Dados exibidos no site (editar aqui)
│       └── admins.ts                # E-mails com acesso ao painel
│
├── types/
│   └── match.ts
│
└── firestore.rules                  # Regras de segurança (colar no console)
```

---

## Modelagem dos dados

| Coleção Firestore | Descrição |
|---|---|
| `matches` | Partidas registradas (data, adversário, resultado, cor, controle de tempo, abertura, notas, PGN). Cada partida tem um `type` (`tournament` / `lichess` / `chesscom` / `manual`) usado para filtrar a lista, além de `source` (`manual` / `lichess` / `chesscom`) e `source_id` (ID do jogo no provedor), usados para evitar importações duplicadas. |

- Qualquer visitante pode ler as partidas (regra `allow read`).
- Só os e-mails listados em `firestore.rules` conseguem criar, editar ou remover partidas — essa é a proteção real dos dados. O arquivo `lib/config/admins.ts` só controla a experiência visual (o que o app mostra), não substitui as regras do Firestore.
- Não existe verificação de sessão no servidor (sem middleware): o guard de `/admin` roda no navegador e a segurança de fato vem do Firestore recusar a escrita para quem não está na lista.

---

## Importação de partidas (Lichess / Chess.com / Chess-Results / CBX)

No painel `/admin`, a seção **Importar partidas** busca seus jogos direto das fontes públicas (sem necessidade de token):

- A rota `app/api/import/route.ts` roda no servidor (serverless no Vercel), consulta o provedor e devolve as partidas já normalizadas para o modelo `Match`. Rodar no servidor evita CORS e permite enviar o `User-Agent` que o Chess.com exige.
- O cliente compara com o que já existe (`source` + `source_id`), mostra uma prévia com a contagem de **novas** vs **já importadas** e só grava no Firestore quando você confirma (em lotes, via `writeBatch`).
- **Lichess / Chess.com** (por nome de usuário): filtros de máximo de partidas, data mínima (`desde`) e somente ranqueadas; importa o PGN completo. Apenas o xadrez padrão é importado (variantes como Chess960 são ignoradas).
- **Chess-Results** (pela URL da ficha do jogador, `art=9`): esse site não tem API, então a rota faz *scraping* da tabela de resultados por rodada (adversário, cor, resultado) e cria partidas do tipo **Torneio**. Só há acesso a `chess-results.com` (proteção contra SSRF). Como o site publica só os resultados, **não há PGN**; a data usada é a do torneio (última atualização) e pode ser ajustada manualmente. A rodada e o rating do adversário ficam nas notas.
- **CBX** (pelo ID CBX do jogador — `lib/import/cbx.ts`): busca a ficha do jogador em `cbx.org.br/jogador/{id}` (lista de torneios disputados) e cruza automaticamente cada um com o chess-results, sem precisar colar URL nenhuma:
  1. Busca torneios no chess-results pela mesma janela de datas do torneio na CBX (`TurnierSuche.aspx` — um formulário ASP.NET WebForms clássico; a rota faz o *postback* completo, incluindo manter a sessão/cookie do mesmo nó do site que serviu o formulário, senão o POST é ignorado).
  2. Rankeia os candidatos por semelhança de título com o nome do torneio na CBX.
  3. Confirma o candidato certo checando em qual deles o nome do jogador aparece de fato na lista final de classificação (`art=1`, coluna "No.Ini." = número do jogador no torneio) — só importa quando encontra essa confirmação; nunca "adivinha" entre candidatos parecidos.
  4. Com o torneio e o número do jogador confirmados, reaproveita a mesma lógica de importação por torneio (`art=9`) já usada no modo Chess-Results direto.
  - **Limitação conhecida**: a data que a CBX mostra para um torneio nem sempre bate com a data que o chess-results indexa para o mesmo evento (a do chess-results tende a refletir quando o resultado foi carregado, não quando foi jogado — já vimos casos com meses de diferença). Quando isso acontece, a busca por data não encontra o torneio certo e ele aparece na lista de "não encontrados automaticamente" — mesmo existindo no chess-results. Nesses casos, a importação por URL direta (que não depende de data) continua sendo o caminho confiável.

---

## Deploy no Vercel

```bash
npm i -g vercel
vercel
```

Adicione no painel do Vercel as variáveis de ambiente listadas em `.env.local.example`.

Depois do primeiro deploy, adicione o domínio de produção (ex: `seu-projeto.vercel.app` ou o domínio customizado) em **Firebase Console → Authentication → Settings → Authorized domains** — sem isso o "Entrar com Google" falha em produção.

---

## Limitações do MVP

| Limitação | Observação |
|---|---|
| Importação do Chess-Results e da CBX não guarda os lances (PGN) | Esses sites publicam só os resultados por rodada; os movimentos da partida não ficam disponíveis para importar (Lichess e Chess.com trazem o PGN completo normalmente) |
| Importação por CBX depende de a data bater entre os dois sites | Ver a limitação conhecida detalhada na seção "Importação de partidas" acima |
| Importação manual (sob demanda) | Não há sincronização automática/agendada — você dispara a importação quando quiser no painel |
| Sem verificação de sessão no servidor | O guard de `/admin` é client-side; a proteção real dos dados é a regra do Firestore |
