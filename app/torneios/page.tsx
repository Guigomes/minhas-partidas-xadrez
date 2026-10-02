'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTournaments } from '@/lib/hooks/use-tournaments';
import { normalizeText } from '@/lib/tournament/player-search';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSpinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/utils/date';

export default function TournamentsPage() {
  const { data: tournaments, isLoading } = useTournaments();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const words = normalizeText(search).split(/\s+/).filter(Boolean);
    return (tournaments ?? []).filter((t) => {
      const name = normalizeText(t.name);
      return words.every((w) => name.includes(w));
    });
  }, [tournaments, search]);

  if (isLoading) return <PageSpinner />;

  return (
    <div className="container-app py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-brand-700 dark:text-brand-400">Torneios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Torneios importados do Chess-Results. Abra um para ver a classificação, os jogadores e as partidas de cada
          rodada.
        </p>
      </div>

      <Input
        label="Buscar torneio"
        placeholder="ex.: caxambu, fenac, sub 11 fem"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        hint={`${filtered.length} de ${tournaments?.length ?? 0} torneios`}
      />

      {!filtered.length ? (
        <EmptyState
          icon="🏆"
          title="Nenhum torneio encontrado"
          description="Tente outras palavras ou importe um torneio no painel de admin."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.tnr}>
              <Link href={`/torneios/${t.tnr}`} className="card block px-4 py-3 hover:border-brand-400 transition-colors">
                <p className="font-medium text-gray-900 dark:text-gray-100 break-words">{t.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(t.date)}</span>
                  <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {t.player_count} jogadores
                  </Badge>
                  <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {t.game_count} partidas
                  </Badge>
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
