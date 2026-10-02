// Torneio completo importado do chess-results: todos os jogadores e todas
// as partidas de todas as rodadas — não só as do jogador configurado em
// lib/config/player.ts. Base da busca de jogadores / adversários.

// Resultado do ponto de vista das brancas. '+-' / '-+' = vitória por W.O.
// (o adversário não compareceu); '--' = os dois ausentes.
export type TournamentGameResult = '1-0' | '0-1' | '1/2-1/2' | '+-' | '-+' | '--';

// Chave do jogador entre torneios: `cbx-<id>` quando o torneio publica o ID
// nacional (CBX), senão `fide-<id>`, senão `nome-<nome normalizado>`.
export type PlayerKey = string;

export type TournamentPlayer = {
  key: PlayerKey;
  snr: number; // número inicial no torneio (No.Ini.)
  name: string;
  title: string | null;
  cbx_id: string | null;
  fide_id: string | null;
  federation: string | null;
  rating: number | null;
  club: string | null;
};

// Lado de uma partida, desnormalizado pra listar sem precisar buscar o jogador.
export type TournamentGameSide = {
  key: PlayerKey;
  snr: number;
  name: string;
  cbx_id: string | null;
  rating: number | null;
};

export type TournamentGame = {
  id: string; // `${tnr}-r${round}-${whiteSnr}-${blackSnr}`
  tnr: string;
  tournament_name: string;
  date: string; // AAAA-MM-DD
  round: number;
  white: TournamentGameSide;
  black: TournamentGameSide;
  result: TournamentGameResult;
  player_keys: [PlayerKey, PlayerKey]; // para consulta com array-contains
};

export type Tournament = {
  tnr: string;
  name: string;
  date: string;
  url: string;
  rounds: number;
  player_count: number;
  game_count: number;
  // Quantos jogadores vieram com ID CBX — torneios escolares e outros sem
  // rating nacional costumam não publicar a coluna "ID".
  cbx_id_count: number;
  // Homologado (vale rating) ou não; null = não informado. O chess-results
  // não diz isso, então é preenchido na importação.
  homologated: boolean | null;
};

// Resposta da rota /api/tournament, antes de gravar no Firestore.
export type ParsedTournament = Tournament & {
  // false = data estimada pela última atualização da página; conferir antes
  // de gravar (torneios antigos escondem a data de início).
  date_exact: boolean;
  players: TournamentPlayer[];
  games: TournamentGame[];
};

// Documento da coleção `players` (um por pessoa, agregando torneios).
export type PlayerProfile = {
  key: PlayerKey;
  name: string;
  title: string | null;
  cbx_id: string | null;
  fide_id: string | null;
  federation: string | null;
  rating: number | null;
  club: string | null;
  tournaments: string[]; // tnrs
};
