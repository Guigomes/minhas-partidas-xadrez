'use client';

import { useMatches } from '@/lib/hooks/use-matches';
import { MatchForm } from '@/components/matches/match-form';
import { MatchSummary } from '@/components/matches/match-summary';
import { MatchTable } from '@/components/matches/match-table';
import { PageSpinner } from '@/components/ui/spinner';

export default function AdminDashboard() {
  const { data: matches, isLoading } = useMatches();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Minhas Partidas</h1>

      <MatchForm />

      {isLoading ? (
        <PageSpinner />
      ) : (
        <>
          <MatchSummary matches={matches ?? []} />
          <MatchTable matches={matches ?? []} editable />
        </>
      )}
    </div>
  );
}
