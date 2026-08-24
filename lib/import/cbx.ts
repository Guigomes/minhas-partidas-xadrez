import { decodeHtmlEntities, stripHtmlTags } from './html-entities';
import { searchTournamentsByDateRange, titleSimilarity, findPlayerSnr } from './chessresults-search';
import { fetchGamesByTnrSnr } from './chessresults';
import type { ImportedGame } from '@/types/match';

// A CBX (Confederação Brasileira de Xadrez) não linka os torneios do
// jogador com o chess-results — cruzamos os dois manualmente: pegamos a
// lista de torneios da ficha do jogador na CBX (nome, datas), procuramos
// candidatos no chess-results pela mesma janela de datas, e confirmamos
// qual candidato é o certo checando em qual deles o nome do jogador
// realmente aparece na lista de participantes.

const CBX_HOST = 'https://www.cbx.org.br';

export type CbxTournamentEntry = {
  cbxId: string;
  name: string;
  dateStart: string; // AAAA-MM-DD
  dateEnd: string; // AAAA-MM-DD
  timeControl: string | null;
};

function brDateToIso(d: string): string {
  const [day, month, year] = d.split('/');
  return `${year}-${month}-${day}`;
}

export async function fetchCbxProfile(cbxId: string): Promise<{ playerName: string; tournaments: CbxTournamentEntry[] }> {
  const res = await fetch(`${CBX_HOST}/jogador/${encodeURIComponent(cbxId)}`, {
    headers: { 'User-Agent': 'minhas-partidas-xadrez' },
  });
  if (!res.ok) throw { status: 502, message: `Erro ao consultar a CBX (HTTP ${res.status}).` };
  const html = await res.text();

  const nameMatch = html.match(/<h2>([^<]+)<\/h2>/);
  if (!nameMatch) throw { status: 404, message: `Jogador com ID CBX "${cbxId}" não encontrado.` };
  const playerName = stripHtmlTags(nameMatch[1]);

  const tableMatch = html.match(/id="ContentPlaceHolder1_gdvTorneios"[\s\S]*?<\/table>/);
  const tournaments: CbxTournamentEntry[] = [];
  if (tableMatch) {
    const rows = tableMatch[0].match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
    for (const row of rows) {
      const m = row.match(
        /<strong>(\d+)\s*-\s*([\s\S]*?)<\/strong><span>(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})[^(]*\(([^)]+)\)/
      );
      if (!m) continue;
      tournaments.push({
        cbxId: m[1],
        name: decodeHtmlEntities(m[2]).trim(),
        dateStart: brDateToIso(m[3]),
        dateEnd: brDateToIso(m[4]),
        timeControl: decodeHtmlEntities(m[5]).trim(),
      });
    }
  }

  return { playerName, tournaments };
}

export type CbxSkippedTournament = { label: string; reason: string };

// A checagem por nome na lista de participantes é o teste definitivo (só
// confirma quando encontra o nome exato); o custo é uma requisição extra
// por candidato. Vale a pena checar vários, já que é comum existirem
// torneios de nomes quase idênticos organizados por estados diferentes na
// mesma data (ex: "Festival Estadual da Criança e Juventude" é um nome
// usado em vários estados) — o ranking por título sozinho não desempata
// isso, só a presença do jogador na lista real.
//
// Limitação conhecida: a data que a CBX mostra para um torneio nem sempre
// bate com a data que o chess-results indexa pro mesmo evento (a segunda
// costuma refletir quando o resultado foi carregado, não quando foi
// jogado — já vimos casos com meses de diferença). Quando isso acontece,
// a busca por data não encontra o torneio certo e ele cai na lista de
// "não encontrados", mesmo existindo no chess-results — nesses casos, a
// importação por URL direta (que não depende de data) continua sendo o
// caminho confiável.
const MAX_CANDIDATES_TO_CHECK = 10;
const MIN_TITLE_SIMILARITY = 0.2;

async function resolveTournament(
  tournament: CbxTournamentEntry,
  playerName: string
): Promise<{ games: ImportedGame[] } | { skipped: CbxSkippedTournament }> {
  let candidates;
  try {
    candidates = await searchTournamentsByDateRange({ dateFrom: tournament.dateStart, dateTo: tournament.dateEnd });
  } catch {
    return { skipped: { label: tournament.name, reason: 'Erro ao buscar no chess-results.' } };
  }

  const ranked = candidates
    .map((c) => ({ ...c, score: titleSimilarity(tournament.name, c.title) }))
    .filter((c) => c.score >= MIN_TITLE_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES_TO_CHECK);

  if (ranked.length === 0) {
    return { skipped: { label: tournament.name, reason: 'Nenhum torneio parecido encontrado no chess-results nessa data.' } };
  }

  for (const candidate of ranked) {
    const snr = await findPlayerSnr({ tnr: candidate.tnr, playerName });
    if (snr) {
      const games = await fetchGamesByTnrSnr({ tnr: candidate.tnr, snr });
      return { games };
    }
  }

  return {
    skipped: {
      label: tournament.name,
      reason: `Encontramos ${ranked.length} torneio(s) parecido(s) no chess-results, mas "${playerName}" não aparece na lista de participantes de nenhum.`,
    },
  };
}

// Cada torneio custa várias requisições sequenciais (busca + checagem de
// candidatos + partidas); mantemos um teto pra não estourar o tempo da
// função serverless (maxDuration em app/api/import/route.ts).
const MAX_TOURNAMENTS = 15;

export async function importFromCbx(cbxId: string): Promise<{ games: ImportedGame[]; skipped: CbxSkippedTournament[] }> {
  const { playerName, tournaments } = await fetchCbxProfile(cbxId);

  const games: ImportedGame[] = [];
  const skipped: CbxSkippedTournament[] = [];

  for (const tournament of tournaments.slice(0, MAX_TOURNAMENTS)) {
    const result = await resolveTournament(tournament, playerName);
    if ('games' in result) games.push(...result.games);
    else skipped.push(result.skipped);
  }

  return { games, skipped };
}
