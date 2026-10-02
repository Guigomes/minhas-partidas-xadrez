'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTournaments } from '@/lib/hooks/use-tournaments';
import { useMatches } from '@/lib/hooks/use-matches';
import { campaigns, numberLabel } from '@/lib/tournament/campaigns';
import { normalizeText } from '@/lib/tournament/player-search';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSpinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/utils/date';

export default function TournamentsPage() {
  const { data: tournaments, isLoading } = useTournaments();
  const { data: matches, isLoading: loadingMatches, isError: matchesError } = useMatches();
  const [mineOnly, setMineOnly] = useState(true);
  const mine = useMemo(() => new Map(campaigns(matches ?? []).filter((c) => c.tnr).map((c) => [c.tnr, c])), [matches]);
  const [search, setSearch] = useState('');
  const [timeControl, setTimeControl] = useState('');

  // Vindo da página inicial (?q=nome do evento): já filtra e mostra todos os torneios.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) {
      setSearch(q);
      setMineOnly(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const words = normalizeText(search).split(/\s+/).filter(Boolean);
    return (tournaments ?? []).filter((t) => {
      if (mineOnly && !mine.has(t.tnr)) return false;
      if (timeControl && (t.time_control ?? 'none') !== timeControl) return false;
      const name = normalizeText(t.name);
      return words.every((w) => name.includes(w));
    });
  }, [tournaments, search, timeControl, mineOnly, mine]);

  if (isLoading || loadingMatches) return <PageSpinner />;

  return (
    <div className="container-app py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-brand-700 dark:text-brand-400">Torneios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Explore a campanha do Miguel, os jogadores e as partidas de cada rodada.
        </p>
      </div>

      <div role="group" aria-label="Participação nos torneios" className="flex flex-wrap gap-2">
        <button aria-pressed={mineOnly} onClick={() => setMineOnly(true)} className={`rounded-full px-4 py-3 text-sm font-semibold ${mineOnly ? 'bg-brand-700 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>Torneios do Miguel</button>
        <button aria-pressed={!mineOnly} onClick={() => setMineOnly(false)} className={`rounded-full px-4 py-3 text-sm font-semibold ${!mineOnly ? 'bg-brand-700 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>Todos os torneios</button>
      </div>
      {matchesError && mineOnly && <p role="alert">Não foi possível identificar as participações do Miguel. Atualize a página ou explore todos os torneios.</p>}

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input
          label="Buscar torneio"
          placeholder="ex.: caxambu, fenac, sub 11 fem"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          hint={`${filtered.length} de ${tournaments?.length ?? 0} torneios`}
        />
        <Select label="Modalidade" value={timeControl} onChange={(e) => setTimeControl(e.target.value)}>
          <option value="">Todas</option>
          <option value="Clássico">Clássico</option>
          <option value="Rápido">Rápido</option>
          <option value="Blitz">Blitz</option>
          <option value="none">Não informada</option>
        </Select>
      </div>

      {!filtered.length ? (
        <EmptyState
          icon="🏆"
          title="Nenhum torneio encontrado"
          description="Tente outras palavras ou selecione todas as modalidades."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.tnr}>
              <Link href={`/torneios/${t.tnr}`} className="card block px-4 py-3 hover:border-brand-400 transition-colors">
                <p className="font-medium text-gray-900 dark:text-gray-100 break-words">{t.name}</p>
                {mine.get(t.tnr) && <p className="mt-2 text-sm font-semibold text-brand-700 dark:text-brand-300">Miguel · {numberLabel(mine.get(t.tnr)!.points)}/{mine.get(t.tnr)!.total} pontos nas partidas registradas</p>}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(t.date)}</span>
                  <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {t.player_count} jogadores
                  </Badge>
                  <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {t.game_count} partidas
                  </Badge>
                  {t.time_control && (
                    <Badge className="bg-gold/20 text-yellow-700 dark:bg-gold/10 dark:text-gold">{t.time_control}</Badge>
                  )}
                  {t.homologated === true && (
                    <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      ✅ Homologado
                    </Badge>
                  )}
                  {t.homologated === false && (
                    <Badge className="bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
                      Não homologado
                    </Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
