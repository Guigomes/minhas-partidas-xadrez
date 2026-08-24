import type { ImportedGame, MatchColor, MatchResult } from '@/types/match';
import { stripHtmlTags } from './html-entities';
import { findPlayerSnr } from './chessresults-search';

// O chess-results.com não tem API: importamos raspando a ficha do jogador
// (art=9). A página traz apenas os RESULTADOS por rodada (adversário, cor,
// resultado) — não os lances (PGN), que esse tipo de torneio não publica.

const ALLOWED_HOST = /(^|\.)chess-results\.com$/;

function parseColor(resCell: string): MatchColor | null {
  if (/Farbew/.test(resCell)) return 'white';
  if (/Farbes/.test(resCell)) return 'black';
  return null;
}

function parseResult(raw: string): MatchResult | null {
  const n = raw.replace(',', '.').trim();
  if (n === '1') return 'win';
  if (n === '0') return 'loss';
  if (n === '½' || n === '0.5' || n === '1/2') return 'draw';
  return null;
}

function tournamentDate(html: string): string {
  // A página (lan=2, espanhol) traz "Última actualización DD.MM.AAAA".
  // Evita o "Servertime" do topo, que é a data de hoje.
  const upd = html.match(/actualizaci[óo]n\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  if (upd) return `${upd[3]}-${upd[2]}-${upd[1]}`;
  return new Date().toISOString().slice(0, 10);
}

function tournamentName(html: string): string {
  const title = html.match(/<title>([\s\S]*?)<\/title>/);
  if (title) {
    const parts = title[1].split(' - ');
    return stripHtmlTags(parts[parts.length - 1]).slice(0, 120);
  }
  return 'Torneio';
}

function idsFromUrl(url: string): { tnr: string; snr: string } {
  const tnr = url.match(/tnr(\d+)/)?.[1] ?? 'x';
  const snr = url.match(/[?&]snr=(\d+)/)?.[1] ?? '0';
  return { tnr, snr };
}

function parsePlayerRoundsHtml(html: string, tnr: string, snr: string): ImportedGame[] {
  const date = tournamentDate(html);
  const tournament = tournamentName(html);

  const games: ImportedGame[] = [];
  // Cada linha de rodada começa com <tr class="CRng..."> na maioria dos
  // modelos de página, mas alguns usam "CRg..." (sem o "n"). A célula de
  // resultado tem uma tabela aninhada (com a cor), então tratamos à parte.
  const parts = html.split(/<tr class="CRn?g[^"]*">/).slice(1);

  for (const part of parts) {
    const resMatch = part.match(
      /<td class="CR"><table>[\s\S]*?(Farbe[ws][^"]*)[\s\S]*?<td[^>]*>([^<]*)<\/td>[\s\S]*?<\/table>/
    );
    const cleaned = part.replace(/<table>[\s\S]*?<\/table>/g, '');
    const rowHtml = cleaned.split('</tr>')[0];
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripHtmlTags(m[1]));

    const round = cells[0];
    if (!/^\d+$/.test(round)) continue; // pula cabeçalho / linhas inválidas
    if (!resMatch) continue; // sem confronto (bye/ausência)

    const color = parseColor(resMatch[1]);
    const result = parseResult(resMatch[2]);
    // Depois de round/board/No.Ini (índices 0-2) vêm nome do adversário,
    // rating e cidade — mas algumas páginas têm uma coluna extra (título
    // FIDE) nesse meio, então não assumimos índices fixos: pulamos células
    // vazias e distinguimos rating/cidade pelo formato (rating é numérico).
    const rest = cells.slice(3).filter((c) => c !== '');
    // Algumas páginas do chess-results deixam uma vírgula sobrando no fim
    // do nome quando o campo de título (categoria FIDE) fica vazio.
    const opponent = rest[0]?.replace(/,\s*$/, '').trim();
    if (!color || !result || !opponent) continue;

    const rating = rest[1] && /^[\d.,]+$/.test(rest[1]) ? rest[1] : '';
    const city = rest[2] && !/^[\d.,½]+$/.test(rest[2]) ? rest[2] : '';
    const notesParts = [tournament, `Rodada ${round}`];
    if (rating) notesParts.push(`Adversário ${rating}${city ? ` (${city})` : ''}`);

    games.push({
      source: 'chessresults',
      source_id: `${tnr}-${snr}-r${round}`,
      date,
      opponent,
      result,
      color,
      time_control: null,
      opening: null,
      pgn: null,
      notes: notesParts.join(' · '),
    });
  }

  return games;
}

export async function fetchChessResultsGames(params: { url: string }): Promise<ImportedGame[]> {
  const { url } = params;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw { status: 400, message: 'URL inválida.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw { status: 400, message: 'URL inválida.' };
  }
  if (!ALLOWED_HOST.test(parsed.hostname)) {
    throw { status: 400, message: 'A URL precisa ser uma ficha de jogador do chess-results.com.' };
  }

  // Garante a visão de resultados do jogador (art=9).
  parsed.searchParams.set('art', '9');
  parsed.searchParams.set('lan', '2');

  const res = await fetch(parsed.toString(), { headers: { 'User-Agent': 'minhas-partidas-xadrez' } });
  if (!res.ok) throw { status: 502, message: `Erro ao consultar o chess-results (HTTP ${res.status}).` };
  const html = await res.text();

  const { tnr, snr } = idsFromUrl(parsed.toString());
  return parsePlayerRoundsHtml(html, tnr, snr);
}

// Usado pelo fluxo de importação via CBX, quando já sabemos o tnr (torneio)
// e o snr (número do jogador dentro dele), sem precisar da URL completa.
export async function fetchGamesByTnrSnr(params: { tnr: string; snr: string }): Promise<ImportedGame[]> {
  const { tnr, snr } = params;
  const url = `https://chess-results.com/tnr${tnr}.aspx?lan=2&art=9&snr=${snr}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'minhas-partidas-xadrez' } });
  if (!res.ok) throw { status: 502, message: `Erro ao consultar o chess-results (HTTP ${res.status}).` };
  const html = await res.text();
  return parsePlayerRoundsHtml(html, tnr, snr);
}

export type ChessResultsUrlSkip = { label: string; reason: string };

// Importa a partir de uma ou mais URLs de torneio, uma por linha. Quando a
// URL já traz "snr" (o fluxo original, colado da ficha do jogador), usa
// direto; quando não traz (ex: URL da página geral do torneio), resolve o
// número do jogador automaticamente pelo nome completo configurado em
// lib/config/player.ts, do mesmo jeito que o fluxo de importação via CBX.
export async function fetchChessResultsGamesFromUrls(params: {
  urls: string[];
  playerFullName: string;
}): Promise<{ games: ImportedGame[]; skipped: ChessResultsUrlSkip[] }> {
  const games: ImportedGame[] = [];
  const skipped: ChessResultsUrlSkip[] = [];

  for (const raw of params.urls) {
    const url = raw.trim();
    if (!url) continue;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      skipped.push({ label: url, reason: 'URL inválida.' });
      continue;
    }
    if (!ALLOWED_HOST.test(parsed.hostname)) {
      skipped.push({ label: url, reason: 'Precisa ser uma URL do chess-results.com.' });
      continue;
    }
    const tnr = parsed.pathname.match(/tnr(\d+)/)?.[1];
    if (!tnr) {
      skipped.push({ label: url, reason: 'Não encontrei o número do torneio (tnr) nessa URL.' });
      continue;
    }

    try {
      if (parsed.searchParams.get('snr')) {
        games.push(...(await fetchChessResultsGames({ url })));
        continue;
      }

      const snr = await findPlayerSnr({ tnr, playerName: params.playerFullName });
      if (!snr) {
        skipped.push({
          label: url,
          reason: `"${params.playerFullName}" não foi encontrado na lista de participantes desse torneio.`,
        });
        continue;
      }
      games.push(...(await fetchGamesByTnrSnr({ tnr, snr })));
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Erro ao importar esse torneio.';
      skipped.push({ label: url, reason: message });
    }
  }

  return { games, skipped };
}
