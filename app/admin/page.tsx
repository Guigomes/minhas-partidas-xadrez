'use client';

import { useMatches } from '@/lib/hooks/use-matches';
import { MatchForm } from '@/components/matches/match-form';
import { MatchImport } from '@/components/matches/match-import';
import { MatchSummary } from '@/components/matches/match-summary';
import { MatchCharts } from '@/components/matches/match-charts';
import { MatchTable } from '@/components/matches/match-table';
import { PageSpinner } from '@/components/ui/spinner';

export default function AdminDashboard() {
  const { data: matches, isLoading } = useMatches();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Minhas Partidas</h1>

      <MatchImport />

      <MatchForm />

      {isLoading ? (
        <PageSpinner />
      ) : (
        <>
          <MatchSummary matches={matches ?? []} />
          <MatchCharts matches={matches ?? []} />
          <MatchTable matches={matches ?? []} editable />
        </>
      )}
    </div>
  );
}
