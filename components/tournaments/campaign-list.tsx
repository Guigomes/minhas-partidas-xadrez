import Link from 'next/link';
import type { Match } from '@/types/match';
import { campaigns, numberLabel, roundOf } from '@/lib/tournament/campaigns';
import { formatDate } from '@/lib/utils/date';
import { PgnDisclosure } from '@/components/matches/match-table';

export function CampaignList({ matches }: { matches: Match[] }) {
  const groups = campaigns(matches);
  if (!groups.length)
    return (
      <p className="card p-6 text-gray-500">
        Nenhuma campanha neste período. Ajuste os filtros para explorar o
        histórico.
      </p>
    );
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <details key={g.id} className="card group">
          <summary className="cursor-pointer p-5 marker:text-brand-600">
            <span className="ml-2 font-semibold">{g.name}</span>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {formatDate(g.date)} ·{' '}
                {g.matches[0].time_control || 'Modalidade não informada'}
              </span>
              <span className="font-bold text-brand-700 dark:text-brand-300">
                {numberLabel(g.points)}/{g.total} pontos nas partidas
                registradas
              </span>
              <span>
                {g.wins} V · {g.draws} E · {g.losses} D
              </span>
            </div>
            <span className="mt-3 block text-sm text-brand-700 dark:text-brand-300 group-open:hidden">
              Ver campanha
            </span>
          </summary>
          <div className="border-t px-5 pb-5">
            <ol className="divide-y dark:divide-gray-800">
              {g.matches.map((m) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 text-sm"
                >
                  <span className="text-gray-500">
                    {roundOf(m) ? `R${roundOf(m)}` : '—'}
                  </span>
                  <div>
                    <span className="font-medium">{m.opponent}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {m.color === 'white' ? 'Brancas' : 'Pretas'}
                      {m.notes?.match(/Adversário\s+(\d+)/)?.[1]
                        ? ` · Rating informado: ${m.notes.match(/Adversário\s+(\d+)/)![1]}`
                        : ''}
                    </span>
                  </div>
                  <span
                    className={
                      m.result === 'win'
                        ? 'font-semibold text-brand-700 dark:text-brand-300'
                        : m.result === 'loss'
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-gray-600 dark:text-gray-300'
                    }
                  >
                    {m.result === 'win'
                      ? '1 · Vitória'
                      : m.result === 'draw'
                        ? '½ · Empate'
                        : '0 · Derrota'}
                  </span>
                  {m.pgn && (
                    <div className="col-span-3">
                      <PgnDisclosure pgn={m.pgn} orientation={m.color} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {g.tnr && (
              <a
                className="mt-3 inline-block text-sm text-brand-700 underline dark:text-brand-300"
                href={`https://chess-results.com/tnr${g.tnr}.aspx?lan=10`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Resultado oficial no Chess-Results ↗
              </a>
            )}
          </div>
        </details>
      ))}
      <Link
        href="/torneios"
        className="inline-block text-sm font-semibold text-brand-700 dark:text-brand-300"
      >
        Explorar torneios e jogadores →
      </Link>
    </div>
  );
}
