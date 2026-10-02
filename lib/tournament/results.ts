import type { TournamentGame } from '@/types/tournament';

// Resultado de uma partida de torneio do ponto de vista de um jogador.
export type Outcome = 'win' | 'loss' | 'draw' | 'forfeit_win' | 'forfeit_loss' | 'double_forfeit';

export function outcomeFor(game: TournamentGame, key: string): Outcome {
  const isWhite = game.white.key === key;
  switch (game.result) {
    case '1-0':
      return isWhite ? 'win' : 'loss';
    case '0-1':
      return isWhite ? 'loss' : 'win';
    case '1/2-1/2':
      return 'draw';
    case '+-':
      return isWhite ? 'forfeit_win' : 'forfeit_loss';
    case '-+':
      return isWhite ? 'forfeit_loss' : 'forfeit_win';
    default:
      return 'double_forfeit';
  }
}

// W.O. não é partida jogada: fica fora das estatísticas e do confronto direto.
export function wasPlayed(game: TournamentGame): boolean {
  return game.result === '1-0' || game.result === '0-1' || game.result === '1/2-1/2';
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  win: 'Vitória',
  loss: 'Derrota',
  draw: 'Empate',
  forfeit_win: 'Vitória (W.O.)',
  forfeit_loss: 'Derrota (W.O.)',
  double_forfeit: 'W.O. duplo',
};

export const OUTCOME_CLASS: Record<Outcome, string> = {
  win: 'text-brand-600 dark:text-brand-400',
  loss: 'text-red-600 dark:text-red-400',
  draw: 'text-gray-600 dark:text-gray-300',
  forfeit_win: 'text-gray-500 dark:text-gray-400',
  forfeit_loss: 'text-gray-500 dark:text-gray-400',
  double_forfeit: 'text-gray-500 dark:text-gray-400',
};
