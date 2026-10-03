'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useBaseCounts, useTournaments } from '@/lib/hooks/use-tournaments';
import { groupEvents } from '@/lib/tournament/events';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSpinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/utils/date';

const LATEST = 8;
const MODALITIES = ['Clássico', 'Rápido', 'Blitz'] as const;

function numberLabel(n: number) {
  return n.toLocaleString('pt-BR');
}

export default function HomePage() {
  const { data: tournaments, isLoading } = useTournaments();
  const { data: counts } = useBaseCounts();

  const events = useMemo(() => groupEvents(tournaments ?? []), [tournaments]);

  const stats = useMemo(() => {
    const list = tournaments ?? [];
    const byModality = new Map<string, number>();
    for (const t of list) {
      const key = t.time_control ?? 'Não informada';
      byModality.set(key, (byModality.get(key) ?? 0) + 1);
    }
    return {
      tournaments: list.length,
      events: events.length,
      games: list.reduce((sum, t) => sum + t.game_count, 0),
      byModality,
    };
  }, [tournaments, events]);

  // Eventos mais recentes; os de data futura (ainda sem partidas) ficam de fora.
  const latest = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return events.filter((e) => e.date <= today).slice(0, LATEST);
  }, [events]);

  return (
    <div>
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="board-pattern absolute inset-0 opacity-30" />
        <div className="container-app relative py-10 sm:py-14">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-200">Base de torneios</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Xadrez em campo</h1>
          <p className="mt-3 max-w-xl text-brand-100">
            Resultados, jogadores e partidas dos torneios importados do Chess-Results.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/torneios"
              className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-900 hover:bg-brand-50"
            >
              Ver todos os torneios
            </Link>
            <Link
              href="/jogadores"
              className="rounded-lg border border-brand-200/50 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Buscar jogador
            </Link>
          </div>
        </div>
      </section>

      <div className="container-app space-y-8 py-8">
        {isLoading ? (
          <PageSpinner />
        ) : !tournaments?.length ? (
          <EmptyState
            icon="🏆"
            title="Nenhum torneio importado ainda"
            description="Os torneios aparecem aqui depois de importados no painel de admin."
          />
        ) : (
          <>
            <section aria-label="Estatísticas gerais" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Tile label="Eventos" value={numberLabel(stats.events)} />
              <Tile label="Torneios" value={numberLabel(stats.tournaments)} hint="uma por categoria" />
              <Tile label="Partidas" value={numberLabel(stats.games)} />
              <Tile label="Jogadores" value={counts ? numberLabel(counts.players) : '—'} hint="únicos" />
              <Tile
                label="Partidas completas"
                value={counts ? numberLabel(counts.pgnGames) : '—'}
                hint="com todos os lances (PGN)"
              />
            </section>

            <section aria-label="Torneios por modalidade" className="card p-4 sm:p-6">
              <h2 className="font-display text-xl text-brand-700 dark:text-brand-400">Por modalidade</h2>
              <ul className="mt-3 space-y-3">
                {[...MODALITIES, 'Não informada'].map((key) => {
                  const count = stats.byModality.get(key) ?? 0;
                  if (!count) return null;
                  const pct = (count / stats.tournaments) * 100;
                  return (
                    <li key={key}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{key}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {numberLabel(count)} · {Math.round(pct)}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden="true">
                        <div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-label="Últimos eventos" className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl text-brand-700 dark:text-brand-400">Últimos eventos</h2>
                <Link href="/torneios" className="text-sm font-medium text-brand-700 dark:text-brand-300 underline underline-offset-4">
                  ver todos
                </Link>
              </div>
              <ul className="space-y-2">
                {latest.map((e) => {
                  const single = e.tournaments.length === 1;
                  return (
                    <li key={e.key}>
                      <Link
                        href={single ? `/torneios/${e.tournaments[0].tnr}` : `/torneios?q=${encodeURIComponent(e.name)}`}
                        className="card block px-4 py-3 hover:border-brand-400 transition-colors"
                      >
                        <p className="font-medium text-gray-900 dark:text-gray-100 break-words">{e.name}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(e.date)}</span>
                          {!single && (
                            <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                              {e.tournaments.length} categorias
                            </Badge>
                          )}
                          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            {numberLabel(e.players)} jogadores
                          </Badge>
                          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            {numberLabel(e.games)} partidas
                          </Badge>
                          {e.timeControls.map((tc) => (
                            <Badge key={tc} className="bg-gold/20 text-yellow-700 dark:bg-gold/10 dark:text-gold">
                              {tc}
                            </Badge>
                          ))}
                          {e.homologated === true && (
                            <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                              ✅ Homologado
                            </Badge>
                          )}
                          {e.homologated === false && (
                            <Badge className="bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
                              Não homologado
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card px-4 py-3 text-center">
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      {hint && <p className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}
