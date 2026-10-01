import type {
  ParsedTournament,
  TournamentGame,
  TournamentGameResult,
  TournamentPlayer,
} from '@/types/tournament';
import { stripHtmlTags } from './html-entities';
import { playerKey } from '../tournament/player-search';

// Importação do torneio INTEIRO no chess-results (todos os jogadores e todas
// as partidas), diferente de chessresults.ts, que só pega as partidas do
// jogador configurado. Duas páginas bastam:
//
//  - art=0 (ranking inicial): número inicial (Nº.), nome, título, "ID"
//    (ID nacional — nos torneios brasileiros com rating CBX é o ID CBX),
//    "ID FIDE", federação, rating e clube.
//  - art=5 (tabela cruzada pelo ranking inicial): uma linha por jogador e uma
//    coluna por rodada, com células tipo "57b1" = jogou de pretas contra o
//    Nº. 57 e venceu. Cada partida aparece duas vezes (uma na linha de cada
//    jogador) e é deduplicada pela chave rodada + brancas + pretas.
//
// Formatos de célula vistos em torneios reais (lan=10): "57b1", "12w0",
// "3w½", "8b+" / "8w-" (W.O.: + venceu por ausência do adversário, - ausente),
// "-1" / "-0" / "-½" (bye ou não emparceirado: sem adversário, não é partida)
// e vazio (rodada ainda não jogada).

const ALLOWED_HOST = /(^|\.)chess-results\.com$/;

type RowResult = '1' | '0' | '½' | '+' | '-';

const WHITE_RESULT: Record<RowResult, TournamentGameResult> = {
  '1': '1-0',
  '0': '0-1',
  '½': '1/2-1/2',
  '+': '+-',
  '-': '-+',
};

const BLACK_RESULT: Record<RowResult, TournamentGameResult> = {
  '1': '0-1',
  '0': '1-0',
  '½': '1/2-1/2',
  '+': '-+',
  '-': '+-',
};

function pageUrl(tnr: string, art: number): string {
  // turdet=YES: torneios antigos escondem as listas atrás do botão "mostrar
  // detalhes do torneio". zeilen=99999: sem paginação.
  return `https://chess-results.com/tnr${tnr}.aspx?lan=10&art=${art}&zeilen=99999&turdet=YES`;
}

async function fetchPage(tnr: string, art: number): Promise<string> {
  const res = await fetch(pageUrl(tnr, art), { headers: { 'User-Agent': 'minhas-partidas-xadrez' } });
  if (!res.ok) throw { status: 502, message: `Erro ao consultar o chess-results (HTTP ${res.status}).` };
  return res.text();
}

function tableRows(html: string): string[][] {
  const rows = html.match(/<tr class="CR[^"]*"[\s\S]*?<\/tr>/g) ?? [];
  return rows.map((row) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => stripHtmlTags(m[1])));
}

// Separa o cabeçalho (a linha que tem a coluna "Nome") das linhas de dados.
function splitHeader(rows: string[][]): { header: string[]; data: string[][] } | null {
  const idx = rows.findIndex((r) => r.includes('Nome'));
  if (idx < 0) return null;
  return { header: rows[idx], data: rows.slice(idx + 1) };
}

function col(header: string[], ...names: string[]): number {
  for (const name of names) {
    const i = header.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

function tournamentName(html: string): string {
  const h2 = html.match(/<h2>([\s\S]*?)<\/h2>/);
  return h2 ? stripHtmlTags(h2[1]).slice(0, 200) : 'Torneio';
}

// `exact: false` = a data é só uma estimativa (a da última atualização) e a
// tela de importação pede pra conferir.
function tournamentDate(html: string): { date: string; exact: boolean } {
  const text = stripHtmlTags(html.replace(/<script[\s\S]*?<\/script>/g, '')).replace(/\s+/g, ' ');
  // "Data 2026/10/01" (início) no bloco de detalhes do torneio. Torneios com
  // mais de 2 semanas escondem esse bloco atrás de um botão (postback).
  const start = text.match(/\bData\s*(\d{4})\/(\d{2})\/(\d{2})/);
  if (start) return { date: `${start[1]}-${start[2]}-${start[3]}`, exact: true };
  // Sem o bloco: "Última Atualização26.09.2026 05:08:42" — costuma ser logo
  // depois da última rodada, mas pode ser bem depois.
  const upd = text.match(/Atualiza\S*\s*(\d{2})\.(\d{2})\.(\d{4})/);
  if (upd) return { date: `${upd[3]}-${upd[2]}-${upd[1]}`, exact: false };
  return { date: new Date().toISOString().slice(0, 10), exact: false };
}

function toInt(s: string | undefined): number | null {
  const n = parseInt((s ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanId(s: string | undefined): string | null {
  const v = (s ?? '').trim();
  return /^\d+$/.test(v) && v !== '0' ? v : null;
}

type ListedPlayer = Omit<TournamentPlayer, 'key'>;

function parsePlayerList(html: string): Map<number, ListedPlayer> {
  const table = splitHeader(tableRows(html));
  if (!table) {
    throw {
      status: 422,
      message: 'Não encontrei a lista de jogadores desse torneio (torneios por equipes não são suportados).',
    };
  }
  const { header, data } = table;
  const snrIdx = col(header, 'Nº.', 'No.');
  const nameIdx = col(header, 'Nome');
  const idIdx = col(header, 'ID'); // ID nacional (CBX), diferente de "ID FIDE"
  const fideIdx = col(header, 'ID FIDE');
  const fedIdx = col(header, 'FED');
  // Rating nacional primeiro; quem não tem (0) cai pro internacional.
  const ratingIdxs = ['EloN', 'Elo', 'Rtg', 'EloI'].map((h) => header.indexOf(h)).filter((i) => i >= 0);
  const clubIdx = col(header, 'Clube/Cidade');

  const players = new Map<number, ListedPlayer>();
  for (const row of data) {
    const snr = toInt(row[snrIdx]);
    const rawName = row[nameIdx]?.trim();
    if (!snr || !rawName) continue;
    // O título (GM, FM, NM, CM...) fica numa coluna sem cabeçalho logo antes
    // do nome.
    const maybeTitle = row[nameIdx - 1]?.trim() ?? '';
    players.set(snr, {
      snr,
      // A lista vem como "Sobrenome, Nome" em alguns torneios; a vírgula só
      // atrapalha a leitura — a chave de nome ignora a ordem das palavras.
      name: rawName.replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' '),
      title: /^[A-Z]{1,4}$/.test(maybeTitle) ? maybeTitle : null,
      cbx_id: idIdx >= 0 ? cleanId(row[idIdx]) : null,
      fide_id: fideIdx >= 0 ? cleanId(row[fideIdx]) : null,
      federation: fedIdx >= 0 ? row[fedIdx] || null : null,
      rating: ratingIdxs.map((i) => toInt(row[i])).find((r) => r !== null) ?? null,
      club: clubIdx >= 0 ? row[clubIdx] || null : null,
    });
  }
  return players;
}

type CrossCell = { round: number; opponent: number; color: 'w' | 'b'; result: RowResult };

function parseCell(raw: string, round: number): CrossCell | null {
  const cell = raw.replace(/\s+/g, '').replace('=', '½');
  const m = cell.match(/^(\d+)([wb])(1|0|½|\+|-)$/);
  if (!m) return null; // vazio, bye ("-1"), não emparceirado ("-0") ou formato desconhecido
  return { round, opponent: Number(m[1]), color: m[2] as 'w' | 'b', result: m[3] as RowResult };
}

function parseCrosstable(html: string): { names: Map<number, string>; cells: Map<number, CrossCell[]> } {
  const table = splitHeader(tableRows(html));
  const names = new Map<number, string>();
  const cells = new Map<number, CrossCell[]>();
  if (!table) return { names, cells };

  const { header, data } = table;
  const snrIdx = col(header, 'Nº.', 'No.');
  const nameIdx = col(header, 'Nome');
  const roundCols = header
    .map((h, i) => ({ round: Number(h.match(/^(\d+)\.Rd$/)?.[1]), i }))
    .filter((c) => c.round > 0);

  for (const row of data) {
    const snr = toInt(row[snrIdx]);
    if (!snr) continue;
    if (row[nameIdx]) names.set(snr, row[nameIdx].replace(/\s+/g, ' ').trim());
    cells.set(
      snr,
      roundCols.map((c) => parseCell(row[c.i] ?? '', c.round)).filter((c): c is CrossCell => c !== null)
    );
  }
  return { names, cells };
}

export function tnrFromUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw { status: 400, message: 'URL inválida.' };
  }
  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || !ALLOWED_HOST.test(parsed.hostname)) {
    throw { status: 400, message: 'Precisa ser uma URL do chess-results.com.' };
  }
  const tnr = parsed.pathname.match(/tnr(\d+)/)?.[1];
  if (!tnr) throw { status: 400, message: 'Não encontrei o número do torneio (tnr) nessa URL.' };
  return tnr;
}

export async function fetchFullTournament(url: string): Promise<ParsedTournament> {
  const tnr = tnrFromUrl(url);
  const [listHtml, crossHtml] = await Promise.all([fetchPage(tnr, 0), fetchPage(tnr, 5)]);
  return buildTournament(tnr, listHtml, crossHtml);
}

// Separado do fetch pra dar pra testar com HTML salvo.
export function buildTournament(tnr: string, listHtml: string, crossHtml: string): ParsedTournament {
  const listed = parsePlayerList(listHtml);
  const cross = parseCrosstable(crossHtml);
  const name = tournamentName(listHtml);
  const { date, exact: date_exact } = tournamentDate(listHtml);

  // Jogadores: a lista inicial traz IDs, rating e o nome na ordem natural
  // ("Tiago Cunha Navarro"; a tabela cruzada usa "Navarro Tiago Cunha").
  // Quem só aparece na tabela cruzada entra sem IDs.
  const snrs = new Set<number>([...listed.keys(), ...cross.names.keys()]);
  const players = new Map<number, TournamentPlayer>();
  for (const snr of snrs) {
    const player: ListedPlayer = listed.get(snr) ?? {
      snr,
      name: cross.names.get(snr) ?? `Jogador ${snr}`,
      title: null,
      cbx_id: null,
      fide_id: null,
      federation: null,
      rating: null,
      club: null,
    };
    players.set(snr, { ...player, key: playerKey(player) });
  }

  const side = (snr: number) => {
    const p = players.get(snr)!;
    return { key: p.key, snr, name: p.name, cbx_id: p.cbx_id, rating: p.rating };
  };

  const games = new Map<string, TournamentGame>();
  for (const [snr, rowCells] of cross.cells) {
    for (const c of rowCells) {
      if (!players.has(c.opponent)) continue;
      const white = c.color === 'w' ? snr : c.opponent;
      const black = c.color === 'w' ? c.opponent : snr;
      const result = (c.color === 'w' ? WHITE_RESULT : BLACK_RESULT)[c.result];
      const id = `${tnr}-r${c.round}-${white}-${black}`;

      const existing = games.get(id);
      if (existing) {
        // Os dois lados ausentes: um diz "-+" e o outro "+-".
        if (existing.result !== result && /[+-]{2}/.test(existing.result) && /[+-]{2}/.test(result)) {
          existing.result = '--';
        }
        continue;
      }

      const w = side(white);
      const b = side(black);
      games.set(id, {
        id,
        tnr,
        tournament_name: name,
        date,
        round: c.round,
        white: w,
        black: b,
        result,
        player_keys: [w.key, b.key],
      });
    }
  }

  const playerList = [...players.values()].sort((a, b) => a.snr - b.snr);
  const gameList = [...games.values()].sort((a, b) => a.round - b.round || a.white.snr - b.white.snr);

  return {
    tnr,
    name,
    date,
    date_exact,
    url: `https://chess-results.com/tnr${tnr}.aspx?lan=10`,
    rounds: gameList.reduce((max, g) => Math.max(max, g.round), 0),
    player_count: playerList.length,
    game_count: gameList.length,
    cbx_id_count: playerList.filter((p) => p.cbx_id).length,
    players: playerList,
    games: gameList,
  };
}
