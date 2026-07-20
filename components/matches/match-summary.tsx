import type { Match } from '@/types/match';

export function MatchSummary({ matches }: { matches: Match[] }) {
  const wins = matches.filter((m) => m.result === 'win').length;
  const losses = matches.filter((m) => m.result === 'loss').length;
  const draws = matches.filter((m) => m.result === 'draw').length;
  const total = matches.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

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
          <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">{losses}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Empates</p>
          <p className="text-2xl font-bold text-gold">{draws}</p>
        </div>
      </div>

      <div className="card p-4 mt-3 text-center">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Taxa de aproveitamento</p>
        <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">{winRate}%</p>
      </div>
    </div>
  );
}
