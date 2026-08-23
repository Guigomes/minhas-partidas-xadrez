'use client';

import { useMatches } from '@/lib/hooks/use-matches';
import { MatchSummary } from '@/components/matches/match-summary';
import { MatchCharts } from '@/components/matches/match-charts';
import { MatchTable } from '@/components/matches/match-table';
import { PageSpinner } from '@/components/ui/spinner';
import { player } from '@/lib/config/player';

export default function HomePage() {
  const { data: matches, isLoading } = useMatches();

  return (
    <div>
      <section className="relative bg-gradient-to-b from-brand-600 via-brand-700 to-brand-900 text-white overflow-hidden">
        <div className="board-pattern absolute inset-0 pointer-events-none" />

        <div className="container-app pt-14 pb-16 sm:pt-20 sm:pb-20 relative text-center">
          <span className="text-5xl" aria-hidden="true">♟️</span>
          <h1 className="font-display leading-none mt-4 mb-2">
            <span className="block text-4xl sm:text-6xl drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]">Minhas Partidas</span>
            <span className="block text-2xl sm:text-3xl text-gold mt-2 drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">de Xadrez</span>
          </h1>
          <p className="text-brand-100 text-sm sm:text-base mt-3">Registro pessoal de {player.name}</p>
        </div>
      </section>

      <div className="container-app py-10">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <>
            <MatchSummary matches={matches ?? []} />
            <MatchCharts matches={matches ?? []} />
            <MatchTable matches={matches ?? []} />
          </>
        )}
      </div>
    </div>
  );
}
