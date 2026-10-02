# Minhas Partidas de Xadrez

## Painel de evolução do Miguel

A página inicial abre nos torneios, com destaque para a campanha mais recente,
filtros globais de período/modalidade, aproveitamento em pontos (vitória = 1;
empate = ½), comparação por modalidade e cor e evolução por torneio. As campanhas
agrupam as partidas pelo ID Chess-Results e ordenam as rodadas numericamente.
Partidas de torneio sem identificador ficam avulsas para evitar agrupamentos incorretos.
Online e outras partidas ficam em contextos separados; a busca na lista online
afeta somente a lista, conforme indicado na interface.

A lista de torneios prioriza as participações identificadas do Miguel e permite
explorar todos os eventos. Cada torneio abre na campanha dele, com acesso aos
adversários e a uma tabela de pontos, sem atribuir colocações não oficiais.

**Limites dos dados:** pontos e destaques consideram as partidas registradas, que
podem não representar todas as rodadas. A tabela do torneio inclui W.O., mas a
importação atual não preserva byes nem desempates oficiais. A classificação oficial
continua disponível pelo link Chess-Results. Ratings publicados nos eventos são
apresentados com contexto e não equivalem a histórico oficial CBX/FIDE. Não são
inferidos pódios, títulos, performance Elo ou análises de lances a partir do placar.

Validação dos cálculos e agrupamento: `npm test`. Verificação de tipos:
`npm run type-check`.

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
- **Jogadores** (`/jogadores`): busca de qualquer jogador dos torneios completos importados, por nome ou ID CBX / FIDE; a ficha do jogador mostra estatísticas, confronto direto com cada adversário e as partidas por torneio
- Modo escuro / claro

### Administrativas
- Login do administrador com Google
- Registro de novas partidas (formulário)
- **Importação automática** do Lichess e do Chess.com (por nome de usuário), de um ou mais torneios do Chess-Results (por URL, com resolução automática do jogador pelo nome quando a URL não traz o `snr`), ou de **todos os torneios de um jogador pelo ID da CBX** (cruza automaticamente com o chess-results) — com prévia e sem duplicar o que já foi importado
- Edição e remoção de partidas na lista
- **Importação de torneio completo** do Chess-Results (por URL): todos os jogadores e todas as partidas de todas as rodadas, com o ID CBX de cada jogador como chave — ver [Torneios completos](#torneios-completos-chess-results)

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

Edite `lib/config/player.ts` com o seu nome e o título do site. Preencha `cbxId` para mostrar o atalho "Adversários de ..." na página `/jogadores`.

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
│       ├── import/route.ts         # Rota serverless que busca partidas nos provedores
│       └── tournament/route.ts     # Rota que busca um torneio inteiro no chess-results
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

## Torneios completos (Chess-Results)

Além das partidas pessoais (`matches`), o painel importa um torneio **inteiro** — quem jogou contra quem, em que rodada, com que cor e quem venceu — para pesquisar antigos adversários de qualquer jogador.

| Coleção Firestore | ID do documento | Descrição |
|---|---|---|
| `tournaments` | `tnr` | Nome, data, URL, rodadas, totais de jogadores/partidas |
| `tournament_games` | `{tnr}-r{rodada}-{Nº brancas}-{Nº pretas}` | Uma partida: brancas, pretas (nome, chave, ID CBX, rating), resultado (`1-0`, `0-1`, `1/2-1/2`, `+-`/`-+` = W.O., `--` = W.O. duplo) e `player_keys` para consultar as partidas de um jogador com `array-contains` |
| `players` | chave do jogador | Um documento por pessoa, agregando torneios: nome, título, ID CBX, FIDE ID, rating, clube, `tournaments` e `search_tokens` (prefixos do nome + IDs, para a busca) |

**Chave do jogador**: `cbx-{ID CBX}` quando o torneio publica a coluna "ID" na lista de jogadores (torneios com rating CBX publicam); senão `fide-{FIDE ID}`; senão `nome-{palavras do nome em ordem alfabética}`. Só a chave por ID CBX/FIDE liga com segurança o mesmo jogador entre torneios diferentes.

**Como importa** (`lib/import/chessresults-tournament.ts`, rota `app/api/tournament/route.ts`): duas páginas por torneio —
- `art=0` (ranking inicial): Nº inicial, nome, título, ID (CBX), ID FIDE, federação, rating, clube;
- `art=5` (tabela cruzada pelo ranking inicial): por rodada, células como `57b1` (pretas contra o Nº 57, venceu), `12w½`, `8b+` / `8w-` (W.O.) e `-1` / `-0` (bye / não emparceirado — não viram partida). Cada partida aparece na linha dos dois jogadores e é deduplicada.

A gravação é feita pelo cliente depois da prévia, em lotes (`writeBatch`). Os IDs são determinísticos, então importar de novo o mesmo torneio atualiza em vez de duplicar. Remover um torneio apaga as partidas dele e tira o `tnr` da lista de cada jogador (os documentos de jogador ficam).

**Limitações**:
- Torneios com mais de 2 semanas escondem a data de início no chess-results (só aparece depois de um *postback*); a prévia usa a data da última atualização e pede para conferir.
- Torneios por equipes não são suportados.
- Torneios sem a coluna "ID" (escolares, sem rating) identificam o jogador pelo nome: homônimos viram a mesma pessoa e a mesma pessoa com grafias diferentes vira duas.

---

## Importação de partidas (Lichess / Chess.com / Chess-Results / CBX)

No painel `/admin`, a seção **Importar partidas** busca seus jogos direto das fontes públicas (sem necessidade de token):

- A rota `app/api/import/route.ts` roda no servidor (serverless no Vercel), consulta o provedor e devolve as partidas já normalizadas para o modelo `Match`. Rodar no servidor evita CORS e permite enviar o `User-Agent` que o Chess.com exige.
- O cliente compara com o que já existe (`source` + `source_id`), mostra uma prévia com a contagem de **novas** vs **já importadas** e só grava no Firestore quando você confirma (em lotes, via `writeBatch`).
- **Lichess / Chess.com** (por nome de usuário): filtros de máximo de partidas, data mínima (`desde`) e somente ranqueadas; importa o PGN completo. Apenas o xadrez padrão é importado (variantes como Chess960 são ignoradas).
- **Chess-Results** (uma ou mais URLs de torneio, uma por linha): esse site não tem API, então a rota faz *scraping* da tabela de resultados por rodada (adversário, cor, resultado) e cria partidas do tipo **Torneio**. Aceita tanto a URL da ficha do jogador (com `snr` na query) quanto a URL geral do torneio — quando falta o `snr`, a rota resolve automaticamente o número do jogador procurando o nome completo configurado em `lib/config/player.ts` na lista de classificação final (`art=1`), do mesmo jeito que o fluxo de CBX. URLs que não resolverem (jogador não encontrado, torneio guarda-chuva com sub-categorias etc.) aparecem numa lista de "não encontrados", sem travar a importação das demais. Só há acesso a `chess-results.com` (proteção contra SSRF). Como o site publica só os resultados, **não há PGN**; a data usada é a do torneio (última atualização) e pode ser ajustada manualmente. A rodada e o rating do adversário ficam nas notas.
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
