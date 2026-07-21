import type { ImportedGame, MatchColor, MatchResult } from '@/types/match';

// Documentação: https://www.chess.com/news/view/published-data-api
const USER_AGENT = 'minhas-partidas-xadrez (https://minhas-partidas-xadrez.vercel.app)';

const CHESSCOM_CLASS_LABELS: Record<string, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rápido',
  daily: 'Diário',
};

// Códigos de resultado do Chess.com que representam empate.
const DRAW_RESULTS = new Set([
  'agreed',
  'repetition',
  'stalemate',
  'insufficient',
  '50move',
  'timevsinsufficient',
]);

type ChessComSide = {
  username: string;
  result: string;
};

type ChessComGame = {
  url: string;
  end_time: number;
  time_class?: string;
  rules?: string;
  rated?: boolean;
  white: ChessComSide;
  black: ChessComSide;
  pgn?: string;
};

function openingFromPgn(pgn: string | undefined): string | null {
  if (!pgn) return null;
  const match = pgn.match(/\[ECOUrl "https?:\/\/[^"]*\/openings\/([^"]+)"\]/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]).replace(/-/g, ' ');
  // Corta a partir do primeiro número de lance (ex: "...13.O-O", " 2.Nf3"),
  // junto com os pontos/espaços que o antecedem, e limpa sobras no fim.
  return slug.replace(/[\s.]*\d.*$/, '').replace(/[\s.]+$/, '').trim() || null;
}

function sourceIdFromUrl(url: string): string {
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] || url;
}

function normalizeGame(game: ChessComGame, username: string): ImportedGame | null {
  if (game.rules && game.rules !== 'chess') return null;

  const lower = username.toLowerCase();
  let color: MatchColor;
  if (game.white.username.toLowerCase() === lower) color = 'white';
  else if (game.black.username.toLowerCase() === lower) color = 'black';
  else return null;

  const mine = color === 'white' ? game.white : game.black;
  const other = color === 'white' ? game.black : game.white;

  let result: MatchResult;
  if (mine.result === 'win') result = 'win';
  else if (DRAW_RESULTS.has(mine.result)) result = 'draw';
  else result = 'loss';

  return {
    source: 'chesscom',
    source_id: sourceIdFromUrl(game.url),
    date: new Date(game.end_time * 1000).toISOString().slice(0, 10),
    opponent: other.username,
    result,
    color,
    time_control: game.time_class ? (CHESSCOM_CLASS_LABELS[game.time_class] ?? null) : null,
    opening: openingFromPgn(game.pgn),
  };
}

async function chesscomFetch(url: string): Promise<Response> {
  return fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
}

export async function fetchChessComGames(params: {
  username: string;
  max: number;
  since?: number;
  ratedOnly?: boolean;
}): Promise<ImportedGame[]> {
  const { username, max, since, ratedOnly } = params;

  const archivesRes = await chesscomFetch(
    `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`
  );
  if (archivesRes.status === 404) throw { status: 404, message: `Usuário "${username}" não encontrado no Chess.com.` };
  if (archivesRes.status === 429) throw { status: 429, message: 'Chess.com limitou as requisições. Tente novamente em alguns instantes.' };
  if (!archivesRes.ok) throw { status: 502, message: `Erro ao consultar o Chess.com (HTTP ${archivesRes.status}).` };

  const { archives } = (await archivesRes.json()) as { archives: string[] };
  const games: ImportedGame[] = [];

  // Percorre os arquivos mensais do mais recente para o mais antigo até
  // atingir o máximo pedido ou passar da data mínima (since).
  for (const archiveUrl of [...archives].reverse()) {
    if (games.length >= max) break;

    const monthRes = await chesscomFetch(archiveUrl);
    if (!monthRes.ok) continue;
    const { games: monthGames } = (await monthRes.json()) as { games: ChessComGame[] };

    // Dentro do mês, do mais recente para o mais antigo.
    for (const game of [...monthGames].reverse()) {
      if (since && game.end_time * 1000 < since) continue;
      if (ratedOnly && !game.rated) continue;
      const normalized = normalizeGame(game, username);
      if (normalized) games.push(normalized);
      if (games.length >= max) break;
    }
  }

  return games;
}
