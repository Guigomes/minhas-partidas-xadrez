import { Chess } from 'chess.js';
import type { TournamentGame } from '@/types/tournament';
import { stripHtmlTags } from './html-entities';
import { nameWords } from '../tournament/player-search';

// Alguns torneios (os que usam tabuleiros eletrônicos) publicam os lances de cada
// partida: a página de emparceiramento de cada rodada (art=2) tem um link
// "PGN" por linha (PartieSuche.aspx?art=36&id=…), e essa página traz os lances.
// Sempre que o torneio tiver, importamos junto com as partidas.

const HOST = 'https://s2.chess-results.com';
const HEADERS = { 'User-Agent': 'minhas-partidas-xadrez' };
const TITLES = new Set(['gm', 'im', 'fm', 'cm', 'nm', 'afm', 'wgm', 'wim', 'wfm', 'wcm', 'wnm', 'mf', 'mi', 'mn', 'wmf', 'wmn', 'cmn', 'cmf', 'fim']);
const MAX_GAMES = 600; // teto por torneio (uma requisição por partida)

const nameKey = (s: string) =>
  nameWords(s)
    .filter((w) => !TITLES.has(w))
    .sort()
    .join('-');

async function get(url: string, tries = 3): Promise<string> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return await res.text();
    } catch {
      // tenta de novo
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return '';
}

type RoundLink = { round: number; white: string; black: string; id: string };

// Linhas da página de emparceiramento de uma rodada que têm link de PGN.
function parseRound(html: string, defaultRound: number): RoundLink[] {
  const out: RoundLink[] = [];
  let round = defaultRound;
  let whiteIdx = -1;
  let blackIdx = -1;
  for (const m of html.matchAll(/<tr class="CR[^"]*"[\s\S]*?<\/tr>/g)) {
    const row = m[0];
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => stripHtmlTags(c[1]).trim());
    if (cells.length === 1) {
      const h = cells[0].match(/^(\d+)\./);
      if (h) round = Number(h[1]);
      continue;
    }
    const w = cells.findIndex((c) => c === 'White' || c === 'Brancas');
    const b = cells.findIndex((c) => c === 'Black' || c === 'Pretas');
    if (w >= 0 && b >= 0) {
      whiteIdx = w;
      blackIdx = b;
      continue;
    }
    const id = row.match(/PartieSuche\.aspx\?art=36&amp;id=(\d+)/)?.[1];
    if (id && whiteIdx >= 0) out.push({ round, white: cells[whiteIdx], black: cells[blackIdx], id });
  }
  return out;
}

type ParsedGame = { white: string; black: string; whiteElo: string; blackElo: string; event: string; date: string; moves: string[] };

function parseGamePage(html: string): ParsedGame | null {
  const moves = [...html.matchAll(/<a class="game\d*" href="javascript:c\(\d+\)" id="l\d+">([^<]+)<\/a>/g)]
    .map((m) => m[1].trim())
    // algumas partidas terminam os lances com o resultado; o resultado é acrescentado depois
    .filter((t) => !/^(1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(t));
  const head = html.match(/<p><b>([^<]+)<\/b>\s*\((\d*)\)\s*-\s*<b>([^<]+)<\/b>\s*\((\d*)\)<br>([^<]*)<\/p>/);
  if (!moves.length || !head) return null;
  const meta = head[5].trim();
  const date = meta.match(/(\d{2})\.(\d{2})\.(\d{4})\s*$/);
  return {
    white: head[1].trim(),
    black: head[3].trim(),
    whiteElo: head[2],
    blackElo: head[4],
    event: meta.replace(/,\s*\d{2}\.\d{2}\.\d{4}\s*$/, '').replace(/\s*\(.*$/, '').trim() || 'Torneio',
    date: date ? `${date[3]}.${date[2]}.${date[1]}` : '????.??.??',
    moves,
  };
}

function buildPgn(g: ParsedGame, round: number, result: TournamentGame['result']): string | null {
  const res = result === '1-0' || result === '0-1' || result === '1/2-1/2' ? result : '*';
  const tag = (k: string, v: string | number) => `[${k} "${String(v).replace(/"/g, "'")}"]`;
  const tags = [tag('Event', g.event), tag('Site', 'chess-results.com'), tag('Date', g.date), tag('Round', round), tag('White', g.white), tag('Black', g.black), tag('Result', res)];
  if (Number(g.whiteElo) > 0) tags.push(tag('WhiteElo', g.whiteElo));
  if (Number(g.blackElo) > 0) tags.push(tag('BlackElo', g.blackElo));
  // lixo de codificação (espaço duplamente codificado) vira espaço
  const moves = g.moves.join(' ').replace(/[^\x00-\x7f]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  const pgn = `${tags.join('\n')}\n\n${moves} ${res}\n`;
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    return chess.history().length ? pgn : null;
  } catch {
    return null;
  }
}

// PGN de cada partida do torneio, por id da partida (tnr-rRODADA-brancas-pretas).
// Torneio sem PGN publicado devolve um mapa vazio (só 1–2 requisições).
export async function fetchPgns(tnr: string, games: TournamentGame[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const rounds = games.reduce((max, g) => Math.max(max, g.round), 0);
  if (!rounds) return result;

  const index = new Map<string, TournamentGame>();
  for (const g of games) index.set(`${g.round}|${nameKey(g.white.name)}|${nameKey(g.black.name)}`, g);

  const links = new Map<string, RoundLink>();
  const loadRound = async (rd: number) => {
    const html = await get(`${HOST}/tnr${tnr}.aspx?lan=10&art=2&rd=${rd}&zeilen=99999&turdet=YES&SNode=S0`);
    for (const l of parseRound(html, rd)) if (!links.has(l.id)) links.set(l.id, l);
  };

  // Sem link na rodada 1 nem na última, o torneio não publica lances.
  await loadRound(1);
  if (!links.size && rounds > 1) await loadRound(rounds);
  if (!links.size) return result;
  for (let rd = 2; rd <= rounds; rd += 4) {
    await Promise.all(Array.from({ length: Math.min(4, rounds - rd + 1) }, (_, i) => loadRound(rd + i)));
  }

  const ids = [...links.keys()].slice(0, MAX_GAMES);
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(
      ids.slice(i, i + 8).map(async (id) => {
        const link = links.get(id)!;
        const game = index.get(`${link.round}|${nameKey(link.white)}|${nameKey(link.black)}`);
        if (!game) return;
        const parsed = parseGamePage(await get(`${HOST}/PartieSuche.aspx?lan=1&art=36&id=${id}`));
        // confere se a partida baixada é dos mesmos jogadores
        if (!parsed || nameKey(parsed.white) !== nameKey(link.white) || nameKey(parsed.black) !== nameKey(link.black)) return;
        const pgn = buildPgn(parsed, game.round, game.result);
        if (pgn) result.set(game.id, pgn);
      })
    );
  }
  return result;
}
