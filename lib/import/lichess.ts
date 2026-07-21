import type { ImportedGame, MatchColor, MatchResult } from '@/types/match';

// Documentação: https://lichess.org/api#tag/Games/operation/apiGamesUser
const LICHESS_SPEED_LABELS: Record<string, string> = {
  ultraBullet: 'Bullet',
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rápido',
  classical: 'Clássico',
  correspondence: 'Correspondência',
};

type LichessPlayer = {
  user?: { name?: string };
  aiLevel?: number;
};

type LichessGame = {
  id: string;
  createdAt: number;
  variant?: string;
  speed?: string;
  winner?: 'white' | 'black';
  players: { white: LichessPlayer; black: LichessPlayer };
  opening?: { name?: string };
};

function playerName(player: LichessPlayer): string {
  if (player.user?.name) return player.user.name;
  if (typeof player.aiLevel === 'number') return `Stockfish nível ${player.aiLevel}`;
  return 'Anônimo';
}

function normalizeGame(game: LichessGame, username: string): ImportedGame | null {
  if (game.variant && game.variant !== 'standard') return null;

  const lower = username.toLowerCase();
  const whiteName = game.players.white.user?.name?.toLowerCase();
  const blackName = game.players.black.user?.name?.toLowerCase();

  let color: MatchColor;
  if (whiteName === lower) color = 'white';
  else if (blackName === lower) color = 'black';
  else return null; // usuário não participou desta partida

  const opponent = playerName(color === 'white' ? game.players.black : game.players.white);

  let result: MatchResult;
  if (!game.winner) result = 'draw';
  else result = game.winner === color ? 'win' : 'loss';

  return {
    source: 'lichess',
    source_id: game.id,
    date: new Date(game.createdAt).toISOString().slice(0, 10),
    opponent,
    result,
    color,
    time_control: game.speed ? (LICHESS_SPEED_LABELS[game.speed] ?? null) : null,
    opening: game.opening?.name ?? null,
  };
}

export async function fetchLichessGames(params: {
  username: string;
  max: number;
  since?: number;
  ratedOnly?: boolean;
}): Promise<ImportedGame[]> {
  const { username, max, since, ratedOnly } = params;
  const query = new URLSearchParams({
    max: String(max),
    opening: 'true',
    moves: 'false',
    pgnInJson: 'false',
  });
  if (since) query.set('since', String(since));
  if (ratedOnly) query.set('rated', 'true');

  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${query}`, {
    headers: { Accept: 'application/x-ndjson' },
  });

  if (res.status === 404) throw { status: 404, message: `Usuário "${username}" não encontrado no Lichess.` };
  if (res.status === 429) throw { status: 429, message: 'Lichess limitou as requisições. Tente novamente em alguns instantes.' };
  if (!res.ok) throw { status: 502, message: `Erro ao consultar o Lichess (HTTP ${res.status}).` };

  const text = await res.text();
  const games: ImportedGame[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const normalized = normalizeGame(JSON.parse(trimmed) as LichessGame, username);
      if (normalized) games.push(normalized);
    } catch {
      // ignora linhas malformadas
    }
  }
  return games;
}
