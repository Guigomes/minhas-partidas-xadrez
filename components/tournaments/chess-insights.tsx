import type { Match } from '@/types/match';
import type { Tournament, TournamentGame } from '@/types/tournament';
import { numberLabel } from '@/lib/tournament/campaigns';
import { outcomeFor, wasPlayed } from '@/lib/tournament/results';
import { formatDate } from '@/lib/utils/date';

// Only include rounds present in the selected personal-match sample.
export function ChessInsights({
  matches,
  games,
  tournaments,
  playerKey,
}: {
  matches: Match[];
  games: TournamentGame[];
  tournaments: Tournament[];
  playerKey: string;
}) {
  const sourceIds = new Set(
    matches.filter((m) => m.source === 'chessresults').map((m) => m.source_id)
  );
  const selected = games.filter((g) => {
    const side = g.white.key === playerKey ? g.white : g.black;
    return (
      g.player_keys.includes(playerKey) &&
      wasPlayed(g) &&
      sourceIds.has(`${g.tnr}-${side.snr}-r${g.round}`)
    );
  });
  const rated = selected
    .map((g) => ({
      game: g,
      opponent: g.white.key === playerKey ? g.black : g.white,
    }))
    .filter((g) => g.opponent.rating !== null && g.opponent.rating > 0);
  const strongestWin = rated
    .filter(({ game }) => outcomeFor(game, playerKey) === 'win')
    .sort((a, b) => b.opponent.rating! - a.opponent.rating!)[0];
  const tournamentMap = new Map(tournaments.map((t) => [t.tnr, t]));
  const snapshots = new Map<
    string,
    { name: string; date: string; rating: number; mode: string; url: string }
  >();
  for (const g of selected) {
    const side = g.white.key === playerKey ? g.white : g.black;
    const t = tournamentMap.get(g.tnr);
    if (side.rating && t)
      snapshots.set(g.tnr, {
        name: t.name,
        date: t.date,
        rating: side.rating,
        mode: t.time_control || 'Não informada',
        url: t.url,
      });
  }
  if (!rated.length && !snapshots.size) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">O contexto das partidas</h2>
      {strongestWin && (
        <div className="card p-5">
          <h3 className="font-semibold">
            Vitória contra o maior rating informado
          </h3>
          <p className="mt-2 text-lg">
            {strongestWin.opponent.name} · {strongestWin.opponent.rating}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {strongestWin.game.tournament_name} ·{' '}
            {formatDate(strongestWin.game.date)}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Entre {rated.length} partidas com rating do adversário disponível
            neste recorte. Os ratings são os publicados nos torneios; podem
            pertencer a sistemas diferentes.
          </p>
        </div>
      )}
      {snapshots.size > 0 && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold">
            Rating informado nos torneios
          </summary>
          <p className="my-3 text-sm text-gray-500 dark:text-gray-400">
            Registros publicados em cada evento, separados por modalidade. Não
            representam uma série oficial CBX ou FIDE: a base não informa o
            sistema de rating.
          </p>
          <div className="space-y-3">
            {[...snapshots.entries()]
              .sort((a, b) => b[1].date.localeCompare(a[1].date))
              .map(([id, s]) => (
                <div key={id} className="border-t pt-3 text-sm">
                  <p className="font-semibold">
                    {s.mode} · {numberLabel(s.rating)} · {formatDate(s.date)}
                  </p>
                  <a
                    className="text-gray-600 underline dark:text-gray-300"
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.name} ↗
                  </a>
                </div>
              ))}
          </div>
        </details>
      )}
    </section>
  );
}
