import type { Match } from '@/types/match';
import { score, numberLabel } from '@/lib/tournament/campaigns';

export function MatchSummary({ matches }: { matches: Match[] }) {
  const wins = matches.filter((m) => m.result === 'win').length;
  const losses = matches.filter((m) => m.result === 'loss').length;
  const draws = matches.filter((m) => m.result === 'draw').length;
  const total = matches.length;
  const stats = score(matches);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Partidas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Vitórias</p>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{wins}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Derrotas</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{losses}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Empates</p>
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{draws}</p>
        </div>
      </div>

      <div className="card p-4 mt-3 text-center">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Taxa de aproveitamento</p>
        <p className="text-3xl font-bold text-brand-700 dark:text-brand-300">{total ? `${numberLabel(stats.percent)}%` : '—'}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{numberLabel(stats.points)} pontos em {total} partidas · Vitória = 1; empate = ½</p>
      </div>
    </div>
  );
}
