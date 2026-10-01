'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMatches } from '@/lib/hooks/use-matches';
import { MatchSummary } from '@/components/matches/match-summary';
import { MatchCharts } from '@/components/matches/match-charts';
import { MatchTable } from '@/components/matches/match-table';
import { ModeSwitch, modeOf, type Mode } from '@/components/matches/mode-switch';
import { PageSpinner } from '@/components/ui/spinner';
import { player } from '@/lib/config/player';

export default function HomePage() {
  const { data: matches, isLoading } = useMatches();
  const [mode, setMode] = useState<Mode | null>(null);

  const counts = useMemo(() => {
    const c: Record<Mode, number> = { tournament: 0, online: 0 };
    for (const m of matches ?? []) c[modeOf(m)]++;
    return c;
  }, [matches]);

  // Escolha lembrada; na primeira visita abre no modo que tem partidas.
  useEffect(() => {
    if (isLoading || mode) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('home-mode');
    } catch {}
    setMode(saved === 'tournament' || saved === 'online' ? saved : counts.tournament >= counts.online ? 'tournament' : 'online');
  }, [isLoading, mode, counts]);

  function chooseMode(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem('home-mode', next);
    } catch {}
  }

  const visible = useMemo(() => (matches ?? []).filter((m) => mode && modeOf(m) === mode), [matches, mode]);

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
        {isLoading || !mode ? (
          <PageSpinner />
        ) : (
          <>
            <ModeSwitch mode={mode} onChange={chooseMode} counts={counts} />
            <MatchSummary matches={visible} />
            <MatchCharts matches={visible} />
            <MatchTable matches={visible} />
          </>
        )}
      </div>
    </div>
  );
}
