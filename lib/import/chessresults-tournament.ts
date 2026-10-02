import type {
  ParsedTournament,
  TournamentGame,
  TournamentGameResult,
  TournamentPlayer,
} from '@/types/tournament';
import { stripHtmlTags } from './html-entities';
import { nameKey, playerKey } from '../tournament/player-search';

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

function pageUrl(tnr: string, art: number, extra = ''): string {
  // turdet=YES: torneios antigos escondem as listas atrás do botão "mostrar
  // detalhes do torneio". zeilen=99999: sem paginação.
  return `https://chess-results.com/tnr${tnr}.aspx?lan=10&art=${art}&zeilen=99999&turdet=YES${extra}`;
}

async function fetchPage(tnr: string, art: number, extra = ''): Promise<string> {
  const res = await fetch(pageUrl(tnr, art, extra), { headers: { 'User-Agent': 'minhas-partidas-xadrez' } });
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

// Festivais e campeonatos por categoria têm um torneio (tnr) por categoria, todos
// com o mesmo nome; a categoria vem num subtítulo (h3) logo antes do nome.
// Sem ela, as categorias ficam indistinguíveis na lista.
function tournamentName(html: string): string {
  const h2 = html.match(/<h2>([\s\S]*?)<\/h2>/);
  const name = h2 ? stripHtmlTags(h2[1]) : 'Torneio';
  const sub = html.match(/<h3 class="CRmsg">([^<]*)(?:<br\/?>[^<]*)?<\/h3>\s*<h2>/i);
  let category = sub ? stripHtmlTags(sub[1]).trim() : '';
  // Alguns torneios usam esse subtítulo pra link/regulamento, não pra categoria.
  if (/https?:|regulamento|informa[cç]/i.test(category)) category = '';
  const full = category && !name.toLowerCase().includes(category.toLowerCase()) ? `${name} — ${category}` : name;
  return full.slice(0, 200);
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

// Emparceiramentos de todas as rodadas (art=2). Serve de plano B quando a tabela
// cruzada não tem colunas de rodada (torneios todos-contra-todos, onde ela vira
// uma matriz de resultados) e dá a data real de cada rodada — "1. Ronda a
// 2026/06/11 às 18h00min" — em vez da data de atualização da página.
type PairingGame = { round: number; white: string; black: string; result: TournamentGameResult };

const PAIRING_RESULT: Record<string, TournamentGameResult> = {
  '1-0': '1-0',
  '0-1': '0-1',
  '½-½': '1/2-1/2',
  '1/2-1/2': '1/2-1/2',
  '+--': '+-',
  '--+': '-+',
  '---': '--',
};

function parsePairings(html: string): { games: PairingGame[]; firstRoundDate: string | null } {
  const games: PairingGame[] = [];
  let firstRoundDate: string | null = null;
  let round = 0;
  let whiteIdx = -1;
  let blackIdx = -1;
  let resultIdx = -1;

  for (const cells of tableRows(html)) {
    if (cells.length === 1) {
      const head = cells[0].match(/^(\d+)\.\s*\S+\s+a?\s*(?:(\d{4})\/(\d{2})\/(\d{2}))?/);
      if (head) {
        round = Number(head[1]);
        if (round === 1 && head[2]) firstRoundDate = `${head[2]}-${head[3]}-${head[4]}`;
      }
      continue;
    }
    const w = cells.findIndex((c) => c === 'White' || c === 'Brancas');
    const b = cells.findIndex((c) => c === 'Black' || c === 'Pretas');
    if (w >= 0 && b >= 0) {
      whiteIdx = w;
      blackIdx = b;
      resultIdx = cells.findIndex((c) => /^(Resultado|Result|Ergebnis)$/.test(c));
      continue;
    }
    if (!round || whiteIdx < 0 || resultIdx < 0) continue;
    const white = cells[whiteIdx]?.trim();
    const black = cells[blackIdx]?.trim();
    // Bye / sem adversário: a linha não tem resultado com dois lados.
    if (!white || !black || /^(bye|not paired|n[aã]o emparceirado)$/i.test(black)) continue;
    const result = PAIRING_RESULT[(cells[resultIdx] ?? '').replace(/\s+/g, '')];
    if (result) games.push({ round, white, black, result });
  }
  return { games, firstRoundDate };
}

// Modalidade (Clássico / Rápido / Blitz). O chess-results informa em "Time control
// (Rapid)" nos detalhes do torneio, que em torneios com mais de 2 semanas ficam
// atrás do botão "mostrar detalhes" (um postback). Quando o campo não existe,
// tenta pelo nome ([STD] / [RPD] / [BLZ], "Rápido", "Blitz").
export type TimeControl = 'Clássico' | 'Rápido' | 'Blitz';

export async function fetchDetailsHtml(tnr: string): Promise<string> {
  const url = `https://s2.chess-results.com/tnr${tnr}.aspx?lan=1&art=0&SNode=S0`;
  const headers = { 'User-Agent': 'minhas-partidas-xadrez' };
  const get = await fetch(url, { headers });
  const html = await get.text();
  const button = html.match(/<input[^>]*id="cb_alleDetails"[^>]*>/)?.[0];
  if (!button) return html;
  const fields: Record<string, string> = {};
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const n = m[0].match(/name="([^"]*)"/)?.[1];
    if (n) fields[n] = (m[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&amp;/g, '&');
  }
  const cookie = (get.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: new URLSearchParams({ ...fields, cb_alleDetails: button.match(/value="([^"]*)"/)?.[1] ?? 'show' }),
  });
  return res.text();
}

export function parseTimeControl(detailsHtml: string, name: string): TimeControl | null {
  const text = stripHtmlTags(detailsHtml.replace(/<script[\s\S]*?<\/script>/g, ''));
  const field = text.match(/Time control\s*\(([^)]*)\)/i)?.[1]?.toLowerCase() ?? '';
  if (/blitz/.test(field)) return 'Blitz';
  if (/rapid/.test(field)) return 'Rápido';
  if (/standard|classic/.test(field)) return 'Clássico';
  if (/\[blz\]|blitz/i.test(name)) return 'Blitz';
  if (/\[rpd\]|r[aá]pido|rapid/i.test(name)) return 'Rápido';
  if (/\[std\]|cl[aá]ssico|standard/i.test(name)) return 'Clássico';
  return null;
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
  // art=2 é opcional (plano B de partidas e data): se falhar, segue sem ele.
  const [listHtml, crossHtml, pairHtml, detailsHtml] = await Promise.all([
    fetchPage(tnr, 0),
    fetchPage(tnr, 5),
    fetchPage(tnr, 2, '&rd=1').catch(() => ''),
    fetchDetailsHtml(tnr).catch(() => ''),
  ]);
  return buildTournament(tnr, listHtml, crossHtml, pairHtml, detailsHtml);
}

// Separado do fetch pra dar pra testar com HTML salvo.
export function buildTournament(tnr: string, listHtml: string, crossHtml: string, pairHtml = '', detailsHtml = ''): ParsedTournament {
  const listed = parsePlayerList(listHtml);
  const cross = parseCrosstable(crossHtml);
  const name = tournamentName(listHtml);
  const pairings = parsePairings(pairHtml);
  const listedDate = tournamentDate(listHtml);
  // A data da 1ª rodada é a data real do torneio; a da página é só um palpite.
  const date = listedDate.exact || !pairings.firstRoundDate ? listedDate.date : pairings.firstRoundDate;
  const date_exact = listedDate.exact || !!pairings.firstRoundDate;

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

  // Todos-contra-todos: sem colunas de rodada na tabela cruzada, as partidas
  // vêm dos emparceiramentos, ligando os nomes aos jogadores (a ordem das
  // palavras varia entre as páginas, então compara pela chave do nome).
  if (games.size === 0 && pairings.games.length) {
    const bySnr = new Map<string, number>();
    for (const p of players.values()) bySnr.set(nameKey(p.name), p.snr);
    for (const g of pairings.games) {
      const white = bySnr.get(nameKey(g.white));
      const black = bySnr.get(nameKey(g.black));
      if (!white || !black) continue;
      const id = `${tnr}-r${g.round}-${white}-${black}`;
      const w = side(white);
      const b = side(black);
      games.set(id, {
        id,
        tnr,
        tournament_name: name,
        date,
        round: g.round,
        white: w,
        black: b,
        result: g.result,
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
    homologated: true,
    time_control: parseTimeControl(detailsHtml, name),
    players: playerList,
    games: gameList,
  };
}
