'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTournament, useTournamentGames, useTournamentPlayers } from '@/lib/hooks/use-tournaments';
import { wasPlayed } from '@/lib/tournament/results';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSpinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import type { TournamentGame } from '@/types/tournament';

type Tab = 'ranking' | 'games';

type Row = {
  key: string;
  name: string;
  title: string | null;
  rating: number | null;
  club: string | null;
  points: number;
};

// Pontos de cada lado; W.O. conta ponto pra quem venceu por ausência.
function gamePoints(g: TournamentGame): [number, number] {
  switch (g.result) {
    case '1-0':
    case '+-':
      return [1, 0];
    case '0-1':
    case '-+':
      return [0, 1];
    case '1/2-1/2':
      return [0.5, 0.5];
    default:
      return [0, 0];
  }
}

const RESULT_TEXT: Record<TournamentGame['result'], string> = {
  '1-0': '1 - 0',
  '0-1': '0 - 1',
  '1/2-1/2': '½ - ½',
  '+-': '1 - 0 (W.O.)',
  '-+': '0 - 1 (W.O.)',
  '--': 'W.O. duplo',
};

export default function TournamentPage() {
  const params = useParams<{ tnr: string }>();
  const tnr = params.tnr;
  const { data: tournament, isLoading } = useTournament(tnr);
  const { data: games } = useTournamentGames(tnr);
  const { data: players } = useTournamentPlayers(tnr);
  const [tab, setTab] = useState<Tab>('ranking');
  const [round, setRound] = useState<number | 'all'>('all');

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    for (const p of players ?? []) {
      map.set(p.key, { key: p.key, name: p.name, title: p.title, rating: p.rating, club: p.club, points: 0 });
    }
    for (const g of games ?? []) {
      const [w, b] = gamePoints(g);
      for (const [side, pts] of [
        [g.white, w],
        [g.black, b],
      ] as const) {
        const r = map.get(side.key) ?? {
          key: side.key,
          name: side.name,
          title: null,
          rating: side.rating,
          club: null,
          points: 0,
        };
        r.points += pts;
        map.set(side.key, r);
      }
    }
    // Pontos, depois rating. O desempate oficial do chess-results não vem na importação.
    return [...map.values()].sort(
      (a, b) => b.points - a.points || (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name, 'pt-BR')
    );
  }, [players, games]);

  const rounds = useMemo(() => [...new Set((games ?? []).map((g) => g.round))].sort((a, b) => a - b), [games]);
  const shown = useMemo(() => (games ?? []).filter((g) => round === 'all' || g.round === round), [games, round]);
  const played = useMemo(() => (games ?? []).filter(wasPlayed).length, [games]);

  if (isLoading) return <PageSpinner />;
  if (!tournament) {
    return (
      <div className="container-app py-10">
        <EmptyState
          icon="🏆"
          title="Torneio não encontrado"
          description="Ele não foi importado."
          action={
            <Link href="/torneios" className="text-sm text-brand-600 underline">
              Voltar aos torneios
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-app py-10 space-y-6">
      <div>
        <Link href="/torneios" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          ← Torneios
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl text-brand-700 dark:text-brand-400 mt-2 break-words">
          {tournament.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(tournament.date)}</span>
          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {tournament.player_count} jogadores
          </Badge>
          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {played} partidas jogadas · {tournament.rounds} rodadas
          </Badge>
          {tournament.homologated === true && (
            <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">✅ Homologado</Badge>
          )}
          {tournament.homologated === false && (
            <Badge className="bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
              Não homologado
            </Badge>
          )}
          <a
            href={tournament.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
          >
            Ver no Chess-Results ↗
          </a>
        </div>
      </div>

      <div role="tablist" className="flex gap-2">
        {(
          [
            ['ranking', 'Classificação e jogadores'],
            ['games', 'Partidas'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === value
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ranking' ? (
        <div className="card p-4 sm:p-6 overflow-x-auto">
          {!games?.length && (
            <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-3">
              Nenhuma partida publicada ainda: só a lista de inscritos.
            </p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Jogador</th>
                <th className="py-2 px-2 font-medium text-center">Rating</th>
                <th className="py-2 px-2 font-medium text-center">Pts</th>
                <th className="py-2 pl-2 font-medium hidden sm:table-cell">Clube / cidade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="border-b border-gray-100 dark:border-gray-800/60">
                  <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/jogadores/${r.key}`} className="text-gray-900 dark:text-gray-100 hover:underline">
                      {r.title && <span className="text-gold mr-1">{r.title}</span>}
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 px-2 text-center text-gray-500 dark:text-gray-400">{r.rating ?? '—'}</td>
                  <td className="py-2 px-2 text-center font-semibold">{r.points}</td>
                  <td className="py-2 pl-2 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{r.club ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['all', ...rounds] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRound(r)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  round === r
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                )}
              >
                {r === 'all' ? 'Todas' : `Rodada ${r}`}
              </button>
            ))}
          </div>
          {!shown.length ? (
            <EmptyState icon="♟️" title="Sem partidas" description="Esse torneio ainda não tem emparceiramentos publicados." />
          ) : (
            <div className="card divide-y divide-gray-100 dark:divide-gray-800/60">
              {shown.map((g) => (
                <div key={g.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="w-8 shrink-0 text-xs text-gray-400">R{g.round}</span>
                  <Link href={`/jogadores/${g.white.key}`} className="flex-1 min-w-0 truncate text-right hover:underline">
                    <span aria-hidden="true">♔ </span>
                    {g.white.name}
                  </Link>
                  <span className="shrink-0 w-24 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {RESULT_TEXT[g.result]}
                  </span>
                  <Link href={`/jogadores/${g.black.key}`} className="flex-1 min-w-0 truncate hover:underline">
                    <span aria-hidden="true">♚ </span>
                    {g.black.name}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
