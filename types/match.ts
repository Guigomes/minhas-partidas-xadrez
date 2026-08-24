export type MatchResult = 'win' | 'loss' | 'draw';
export type MatchColor = 'white' | 'black';
export type MatchSource = 'manual' | 'lichess' | 'chesscom' | 'chessresults';

// Categoria da partida, escolhida pelo usuário / derivada da origem.
// Usada para filtrar a lista.
export type MatchType = 'tournament' | 'lichess' | 'chesscom' | 'manual';

export type Match = {
  id: string;
  date: string;
  opponent: string;
  result: MatchResult;
  color: MatchColor;
  type: MatchType;
  time_control: string | null;
  opening: string | null;
  notes: string | null;
  pgn: string | null;
  source: MatchSource;
  source_id: string | null;
  created_at: string;
};

export type MatchFormValues = {
  date: string;
  opponent: string;
  result: MatchResult;
  color: MatchColor;
  type: MatchType;
  time_control?: string;
  opening?: string;
  notes?: string;
};

// Partida normalizada vinda de um provedor externo (Lichess / Chess.com),
// pronta para virar um Match. Gerada pela rota /api/import.
export type ImportedGame = {
  source: Exclude<MatchSource, 'manual'>;
  source_id: string;
  date: string;
  opponent: string;
  result: MatchResult;
  color: MatchColor;
  time_control: string | null;
  opening: string | null;
  pgn: string | null;
  notes?: string | null;
};

// 'cbx' não é uma origem de partida por si só (os jogos encontrados por
// esse caminho continuam com source: 'chessresults') — é só mais um jeito
// de descobrir quais partidas importar, buscando os torneios do jogador na
// CBX e cruzando com o chess-results.
export type ImportProvider = Exclude<MatchSource, 'manual'> | 'cbx';
