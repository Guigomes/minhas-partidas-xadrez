import { decodeHtmlEntities, stripHtmlTags } from './html-entities';

// Busca de torneios no chess-results.com (TurnierSuche.aspx). Diferente da
// ficha de um jogador (GET simples), essa página é um formulário ASP.NET
// WebForms clássico: exige POST com os tokens de __VIEWSTATE da mesma
// "sessão" (o site tem vários nós — s1/s2/s3 — e o postback só funciona no
// mesmo nó que serviu o GET inicial, daí guardarmos os cookies entre as
// duas requisições).

const SEARCH_PATH = 'https://chess-results.com/TurnierSuche.aspx?lan=2';

type ViewState = { url: string; cookie: string; viewState: string; viewStateGenerator: string; eventValidation: string };

async function loadSearchForm(): Promise<ViewState> {
  const res = await fetch(SEARCH_PATH, { headers: { 'User-Agent': 'minhas-partidas-xadrez' } });
  if (!res.ok) throw { status: 502, message: `Erro ao consultar o chess-results (HTTP ${res.status}).` };
  const html = await res.text();
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';

  const viewState = html.match(/id="__VIEWSTATE" value="([^"]*)"/)?.[1];
  const viewStateGenerator = html.match(/id="__VIEWSTATEGENERATOR" value="([^"]*)"/)?.[1];
  const eventValidation = html.match(/id="__EVENTVALIDATION" value="([^"]*)"/)?.[1];
  if (!viewState || !viewStateGenerator || !eventValidation) {
    throw { status: 502, message: 'Não foi possível carregar o formulário de busca do chess-results.' };
  }

  return { url: res.url, cookie, viewState, viewStateGenerator, eventValidation };
}

export type TournamentCandidate = {
  tnr: string;
  title: string;
  dateStart: string;
  dateEnd: string;
};

// Data no formato aceito pelo campo do formulário: AAAA-MM-DD (input type=date).
export async function searchTournamentsByDateRange(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<TournamentCandidate[]> {
  const form = await loadSearchForm();

  const body = new URLSearchParams({
    __VIEWSTATE: form.viewState,
    __VIEWSTATEGENERATOR: form.viewStateGenerator,
    __EVENTVALIDATION: form.eventValidation,
    'ctl00$P1$txt_von_tag': params.dateFrom,
    'ctl00$P1$txt_bis_tag': params.dateTo,
    // "3" = 1000 linhas (é um índice, não o número direto — ver as opções
    // do <select> combo_anzahl_zeilen no formulário).
    'ctl00$P1$combo_anzahl_zeilen': '3',
    'ctl00$P1$cb_suchen': 'Buscar',
  });

  const res = await fetch(form.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'minhas-partidas-xadrez',
      Referer: form.url,
      Origin: 'https://chess-results.com',
      ...(form.cookie ? { Cookie: form.cookie } : {}),
    },
    body: body.toString(),
  });
  if (!res.ok) throw { status: 502, message: `Erro ao buscar torneios no chess-results (HTTP ${res.status}).` };
  const html = await res.text();

  const rows = html.match(/<tr class="CRg[12]">[\s\S]*?<\/tr>/g) ?? [];
  const candidates: TournamentCandidate[] = [];
  for (const row of rows) {
    const link = row.match(/href="(tnr\d+)\.aspx[^"]*">([^<]+)<\/a>/);
    const dates = row.match(/(\d{4}\/\d{2}\/\d{2})/g);
    if (!link || !dates || dates.length < 2) continue;
    candidates.push({
      tnr: link[1].replace('tnr', ''),
      title: decodeHtmlEntities(link[2]).trim(),
      dateStart: dates[0].replace(/\//g, '-'),
      dateEnd: dates[1].replace(/\//g, '-'),
    });
  }
  return candidates;
}

// Normaliza pra comparar nomes de torneio entre CBX e chess-results, que
// quase nunca batem letra por letra (ordem das palavras, abreviações etc).
function significantWords(s: string): Set<string> {
  const normalized = s
    .normalize('NFD')
    .split('')
    .filter((ch) => ch.charCodeAt(0) < 0x0300 || ch.charCodeAt(0) > 0x036f)
    .join('')
    .toLowerCase();
  const words = normalized.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  return new Set(words);
}

// Pontua o quanto duas descrições de torneio se parecem (0 a 1), pela
// proporção de palavras relevantes em comum.
export function titleSimilarity(a: string, b: string): number {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / Math.min(wordsA.size, wordsB.size);
}

// Compara nomes por conjunto de palavras (ignorando ordem/vírgula), já que
// a lista de classificação final do chess-results usa "Sobrenome, Nome"
// (padrão FIDE), diferente do "Nome Sobrenome" usado em outras páginas do
// site e na CBX.
function nameWordSet(s: string): string {
  const normalized = s
    .normalize('NFD')
    .split('')
    .filter((ch) => ch.charCodeAt(0) < 0x0300 || ch.charCodeAt(0) > 0x036f)
    .join('')
    .toLowerCase();
  return normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

// Procura o jogador (por nome) na lista final de classificação de um
// torneio (art=1), que traz a coluna "No.Ini." — o snr que precisamos para
// buscar as partidas dele (art=9).
export async function findPlayerSnr(params: { tnr: string; playerName: string }): Promise<string | null> {
  const url = `https://chess-results.com/tnr${params.tnr}.aspx?lan=2&art=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'minhas-partidas-xadrez' } });
  if (!res.ok) return null;
  const html = await res.text();

  const target = nameWordSet(params.playerName);
  // A classe da linha varia entre modelos de página ("CRng1"/"CRng2" na
  // maioria, "CRg1"/"CRg2" em outras); e a coluna do nome nem sempre é a
  // seguinte ao "No.Ini." — algumas listagens têm uma coluna extra (título
  // FIDE, categoria) entre elas. Por isso procuramos o nome em qualquer
  // célula após o snr, em vez de assumir um índice fixo.
  const rows = html.match(/<tr class="CRn?g[12][^"]*">[\s\S]*?<\/tr>/g) ?? [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripHtmlTags(m[1]));
    const snr = cells[1];
    if (!snr || !/^\d+$/.test(snr)) continue;
    if (cells.slice(2).some((c) => c && nameWordSet(c) === target)) return snr;
  }
  return null;
}
