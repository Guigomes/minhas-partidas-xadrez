import type { ImportedGame } from '@/types/match';
import type { ParsedTournament } from '@/types/tournament';
import { outcomeFor, wasPlayed } from './results';

// Partidas do jogador configurado dentro de um torneio completo, no formato
// da lista principal (`matches`). O source_id segue o mesmo padrão do import
// por URL (chessresults.ts), então os dois caminhos não duplicam partidas.
// W.O. fica de fora: não é partida jogada.
export function myMatchesFrom(t: ParsedTournament, cbxId: string): ImportedGame[] {
  const me = t.players.find((p) => p.cbx_id === cbxId);
  if (!me) return [];

  const games: ImportedGame[] = [];
  for (const g of t.games) {
    if (!wasPlayed(g)) continue;
    const isWhite = g.white.key === me.key;
    if (!isWhite && g.black.key !== me.key) continue;

    const opp = isWhite ? g.black : g.white;
    const outcome = outcomeFor(g, me.key);
    const notes = [t.name, `Rodada ${g.round}`];
    if (opp.rating) notes.push(`Adversário ${opp.rating}`);

    games.push({
      source: 'chessresults',
      source_id: `${t.tnr}-${me.snr}-r${g.round}`,
      date: t.date,
      opponent: opp.name,
      result: outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : 'loss',
      color: isWhite ? 'white' : 'black',
      time_control: null,
      opening: null,
      pgn: null,
      notes: notes.join(' · '),
      homologated: t.homologated,
    });
  }
  return games;
}
