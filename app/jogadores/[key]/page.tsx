'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePlayer, usePlayerGames, useTournaments } from '@/lib/hooks/use-tournaments';
import { OUTCOME_CLASS, OUTCOME_LABEL, outcomeFor, wasPlayed } from '@/lib/tournament/results';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSpinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import type { TournamentGame } from '@/types/tournament';

type OpponentRecord = {
  key: string;
  name: string;
  cbx_id: string | null;
  wins: number;
  draws: number;
  losses: number;
  lastDate: string;
};

export default function PlayerPage() {
  const params = useParams<{ key: string }>();
  const key = decodeURIComponent(params.key);
  const { data: profile, isLoading: loadingProfile } = usePlayer(key);
  const { data: games, isLoading: loadingGames } = usePlayerGames(key);
  const { data: tournaments } = useTournaments();
  const timeControlByTnr = useMemo(() => new Map((tournaments ?? []).map((t) => [t.tnr, t.time_control ?? null])), [tournaments]);
  const homologatedByTnr = useMemo(() => new Map((tournaments ?? []).map((t) => [t.tnr, t.homologated ?? null])), [tournaments]);

  const stats = useMemo(() => {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let forfeits = 0;
    for (const g of games ?? []) {
      if (!wasPlayed(g)) {
        forfeits++;
        continue;
      }
      const o = outcomeFor(g, key);
      if (o === 'win') wins++;
      else if (o === 'draw') draws++;
      else losses++;
    }
    const played = wins + draws + losses;
    const pct = played ? Math.round(((wins + draws / 2) / played) * 100) : 0;
    return { wins, draws, losses, played, forfeits, pct };
  }, [games, key]);

  // Confronto direto com cada adversário (só partidas jogadas, sem W.O.).
  const opponents = useMemo(() => {
    const map = new Map<string, OpponentRecord>();
    for (const g of games ?? []) {
      if (!wasPlayed(g)) continue;
      const opp = g.white.key === key ? g.black : g.white;
      const rec = map.get(opp.key) ?? {
        key: opp.key,
        name: opp.name,
        cbx_id: opp.cbx_id,
        wins: 0,
        draws: 0,
        losses: 0,
        lastDate: g.date,
      };
      const o = outcomeFor(g, key);
      if (o === 'win') rec.wins++;
      else if (o === 'draw') rec.draws++;
      else rec.losses++;
      if (g.date > rec.lastDate) rec.lastDate = g.date;
      map.set(opp.key, rec);
    }
    return [...map.values()].sort(
      (a, b) => b.wins + b.draws + b.losses - (a.wins + a.draws + a.losses) || a.name.localeCompare(b.name, 'pt-BR')
    );
  }, [games, key]);

  const byTournament = useMemo(() => {
    const map = new Map<string, { name: string; date: string; games: TournamentGame[] }>();
    for (const g of games ?? []) {
      const t = map.get(g.tnr) ?? { name: g.tournament_name, date: g.date, games: [] };
      t.games.push(g);
      map.set(g.tnr, t);
    }
    return [...map.entries()];
  }, [games]);

  if (loadingProfile || loadingGames) return <PageSpinner />;

  if (!profile && !games?.length) {
    return (
      <div className="container-app py-10">
        <EmptyState
          icon="🔍"
          title="Jogador não encontrado"
          description="Ele ainda não aparece em nenhum torneio importado."
          action={
            <Link href="/jogadores" className="text-sm text-brand-600 underline">
              Voltar para a busca
            </Link>
          }
        />
      </div>
    );
  }

  const name = profile?.name ?? games![0][games![0].white.key === key ? 'white' : 'black'].name;

  return (
    <div className="container-app py-10 space-y-8">
      <div>
        <Link href="/jogadores" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          ← Jogadores
        </Link>
        <h1 className="font-display text-3xl text-brand-700 dark:text-brand-400 mt-2">
          {profile?.title && <span className="text-gold mr-2">{profile.title}</span>}
          {name}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-2">
          {profile?.cbx_id ? (
            <a
              href={`https://www.cbx.org.br/jogador/${profile.cbx_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              CBX {profile.cbx_id} ↗
            </a>
          ) : (
            <span>sem ID CBX</span>
          )}
          {profile?.fide_id && (
            <a
              href={`https://ratings.fide.com/profile/${profile.fide_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              FIDE {profile.fide_id} ↗
            </a>
          )}
          {profile?.rating && <span>Rating {profile.rating}</span>}
          {profile?.club && <span>{profile.club}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Partidas" value={stats.played} />
        <Stat label="Vitórias" value={stats.wins} className="text-brand-600 dark:text-brand-400" />
        <Stat label="Empates" value={stats.draws} className="text-yellow-700 dark:text-gold" />
        <Stat label="Derrotas" value={stats.losses} className="text-red-600 dark:text-red-400" />
        <Stat label="Aproveitamento" value={`${stats.pct}%`} />
      </div>
      {stats.forfeits > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-5">
          + {stats.forfeits} {stats.forfeits === 1 ? 'partida' : 'partidas'} por W.O., fora das estatísticas.
        </p>
      )}

      {opponents.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-xl text-brand-700 dark:text-brand-400 mb-3">
            Adversários ({opponents.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-3 font-medium">Adversário</th>
                  <th className="py-2 px-2 font-medium text-center">Jogos</th>
                  <th className="py-2 px-2 font-medium text-center" title="Vitórias / Empates / Derrotas">
                    V / E / D
                  </th>
                  <th className="py-2 pl-2 font-medium text-right">Último</th>
                </tr>
              </thead>
              <tbody>
                {opponents.map((o) => (
                  <tr key={o.key} className="border-b border-gray-100 dark:border-gray-800/60">
                    <td className="py-2 pr-3">
                      <Link href={`/jogadores/${o.key}`} className="text-gray-900 dark:text-gray-100 hover:underline">
                        {o.name}
                      </Link>
                      {o.cbx_id && <span className="text-xs text-gray-400 ml-2">CBX {o.cbx_id}</span>}
                    </td>
                    <td className="py-2 px-2 text-center">{o.wins + o.draws + o.losses}</td>
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <span className="text-brand-600 dark:text-brand-400">{o.wins}</span> /{' '}
                      <span className="text-yellow-700 dark:text-gold">{o.draws}</span> /{' '}
                      <span className="text-red-600 dark:text-red-400">{o.losses}</span>
                    </td>
                    <td className="py-2 pl-2 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(o.lastDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-display text-xl text-brand-700 dark:text-brand-400">Partidas por torneio</h2>
        {byTournament.map(([tnr, t]) => (
          <div key={tnr} className="card p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <a
                href={`https://chess-results.com/tnr${tnr}.aspx?lan=10`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-900 dark:text-gray-100 hover:underline"
              >
                {t.name} ↗
              </a>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(t.date)}
                {timeControlByTnr.get(tnr) && ` · ${timeControlByTnr.get(tnr)}`}
                {homologatedByTnr.get(tnr) === true && ' · ✅ homologado'}
                {homologatedByTnr.get(tnr) === false && ' · não homologado'}
              </span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {[...t.games]
                .sort((a, b) => a.round - b.round)
                .map((g) => {
                  const isWhite = g.white.key === key;
                  const opp = isWhite ? g.black : g.white;
                  const o = outcomeFor(g, key);
                  return (
                    <li key={g.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-8 shrink-0">R{g.round}</span>
                        <span title={isWhite ? 'Brancas' : 'Pretas'} className="shrink-0">
                          {isWhite ? '♔' : '♚'}
                        </span>
                        <Link href={`/jogadores/${opp.key}`} className="truncate hover:underline">
                          {opp.name}
                        </Link>
                        {opp.rating && <span className="text-xs text-gray-400 shrink-0">({opp.rating})</span>}
                      </div>
                      <span className={cn('shrink-0 text-xs font-semibold', OUTCOME_CLASS[o])}>
                        {OUTCOME_LABEL[o]}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className="card px-4 py-3 text-center">
      <p className={cn('text-2xl font-bold text-gray-900 dark:text-gray-100', className)}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
