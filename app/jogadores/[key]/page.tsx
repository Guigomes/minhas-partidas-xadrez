'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePlayer, usePlayerGames, useTournaments } from '@/lib/hooks/use-tournaments';
import { OUTCOME_CLASS, OUTCOME_LABEL, outcomeFor, wasPlayed } from '@/lib/tournament/results';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { PageSpinner } from '@/components/ui/spinner';
import { GameViewerButton } from '@/components/tournaments/game-viewer';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import type { TournamentGame } from '@/types/tournament';
import { numberLabel } from '@/lib/tournament/campaigns';

type Detail = 'tournaments' | 'win' | 'draw' | 'loss' | 'pgn';

const DETAIL_PAGE = 30;

type OpponentSort = 'games' | 'recent' | 'oldest' | 'name' | 'wins' | 'losses' | 'percent';

const OPPONENT_SORT_OPTIONS: { value: OpponentSort; label: string }[] = [
  { value: 'games', label: 'Mais jogos' },
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'name', label: 'Nome (A-Z)' },
  { value: 'wins', label: 'Mais vitórias' },
  { value: 'losses', label: 'Mais derrotas' },
  { value: 'percent', label: 'Melhor aproveitamento' },
];

type OpponentRecord = {
  key: string;
  name: string;
  cbx_id: string | null;
  wins: number;
  draws: number;
  losses: number;
  lastDate: string;
  games: TournamentGame[];
};

export default function PlayerPage() {
  const params = useParams<{ key: string }>();
  const key = decodeURIComponent(params.key);
  const { data: profile, isLoading: loadingProfile } = usePlayer(key);
  const { data: games, isLoading: loadingGames } = usePlayerGames(key);
  const { data: tournaments } = useTournaments();
  const [openOpponents, setOpenOpponents] = useState<Set<string>>(new Set());
  const [opponentSort, setOpponentSort] = useState<OpponentSort>('games');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLimit, setDetailLimit] = useState(DETAIL_PAGE);

  function toggleDetail(next: Detail) {
    setDetail((cur) => (cur === next ? null : next));
    setDetailLimit(DETAIL_PAGE);
  }

  function toggleOpponent(opponentKey: string) {
    setOpenOpponents((prev) => {
      const next = new Set(prev);
      if (!next.delete(opponentKey)) next.add(opponentKey);
      return next;
    });
  }
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
    const pct = played ? ((wins + draws / 2) / played) * 100 : 0;
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
        games: [],
      };
      rec.games.push(g);
      const o = outcomeFor(g, key);
      if (o === 'win') rec.wins++;
      else if (o === 'draw') rec.draws++;
      else rec.losses++;
      if (g.date > rec.lastDate) rec.lastDate = g.date;
      map.set(opp.key, rec);
    }
    for (const rec of map.values()) {
      rec.games.sort((a, b) => b.date.localeCompare(a.date) || a.round - b.round);
    }
    return [...map.values()].sort(
      (a, b) => b.wins + b.draws + b.losses - (a.wins + a.draws + a.losses) || a.name.localeCompare(b.name, 'pt-BR')
    );
  }, [games, key]);

  const sortedOpponents = useMemo(() => {
    const total = (o: OpponentRecord) => o.wins + o.draws + o.losses;
    const percent = (o: OpponentRecord) => (o.wins + o.draws / 2) / total(o);
    const byName = (a: OpponentRecord, b: OpponentRecord) => a.name.localeCompare(b.name, 'pt-BR');
    const compare: Record<OpponentSort, (a: OpponentRecord, b: OpponentRecord) => number> = {
      games: (a, b) => total(b) - total(a) || byName(a, b),
      recent: (a, b) => b.lastDate.localeCompare(a.lastDate) || byName(a, b),
      oldest: (a, b) => a.lastDate.localeCompare(b.lastDate) || byName(a, b),
      name: byName,
      wins: (a, b) => b.wins - a.wins || total(b) - total(a) || byName(a, b),
      losses: (a, b) => b.losses - a.losses || total(b) - total(a) || byName(a, b),
      percent: (a, b) => percent(b) - percent(a) || total(b) - total(a) || byName(a, b),
    };
    return [...opponents].sort(compare[opponentSort]);
  }, [opponents, opponentSort]);

  const byTournament = useMemo(() => {
    const map = new Map<string, { name: string; date: string; games: TournamentGame[] }>();
    for (const g of games ?? []) {
      const t = map.get(g.tnr) ?? { name: g.tournament_name, date: g.date, games: [] };
      t.games.push(g);
      map.set(g.tnr, t);
    }
    return [...map.entries()];
  }, [games]);

  // Partidas jogadas de um resultado (vitória, empate ou derrota), da mais recente para a mais antiga.
  const detailGames = useMemo(() => {
    if (detail !== 'win' && detail !== 'draw' && detail !== 'loss' && detail !== 'pgn') return [];
    return (games ?? [])
      .filter((g) => {
        if (detail === 'pgn') return !!g.pgn;
        if (!wasPlayed(g)) return false;
        const o = outcomeFor(g, key);
        return detail === 'win' ? o === 'win' : detail === 'draw' ? o === 'draw' : o === 'loss';
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.tnr.localeCompare(a.tnr) || a.round - b.round);
  }, [games, key, detail]);

  const pgnCount = (games ?? []).filter((g) => g.pgn).length;

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
          {profile?.rating && <span>Rating cadastrado {profile.rating} · modalidade/data não informadas</span>}
          {profile?.club && <span>{profile.club}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <Stat label="Torneios" value={byTournament.length} active={detail === 'tournaments'} onClick={() => toggleDetail('tournaments')} />
        <Stat label="Partidas" value={stats.played} href="#partidas" />
        <Stat label="Vitórias" value={stats.wins} className="text-brand-600 dark:text-brand-400" active={detail === 'win'} onClick={() => toggleDetail('win')} />
        <Stat label="Empates" value={stats.draws} className="text-gray-600 dark:text-gray-300" active={detail === 'draw'} onClick={() => toggleDetail('draw')} />
        <Stat label="Derrotas" value={stats.losses} className="text-red-600 dark:text-red-400" active={detail === 'loss'} onClick={() => toggleDetail('loss')} />
        <Stat
          label="Com lances"
          value={pgnCount}
          active={detail === 'pgn'}
          onClick={pgnCount > 0 ? () => toggleDetail('pgn') : undefined}
        />
        <Stat label="Aproveitamento" value={stats.played ? `${numberLabel(stats.pct)}%` : '—'} />
      </div>
      {stats.forfeits > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-5">
          + {stats.forfeits} {stats.forfeits === 1 ? 'partida' : 'partidas'} por W.O., fora das estatísticas.
        </p>
      )}

      {detail && (
        <section id="detalhe" className="card p-4 sm:p-6" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl text-brand-700 dark:text-brand-400">
              {detail === 'tournaments'
                ? `Torneios (${byTournament.length})`
                : `${detail === 'win' ? 'Vitórias' : detail === 'draw' ? 'Empates' : detail === 'loss' ? 'Derrotas' : 'Partidas com lances'} (${detailGames.length})`}
            </h2>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="shrink-0 py-1 text-sm font-medium text-brand-700 dark:text-brand-300 underline underline-offset-2"
            >
              fechar
            </button>
          </div>

          {detail === 'tournaments' ? (
            <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800/60">
              {[...byTournament]
                .sort((a, b) => b[1].date.localeCompare(a[1].date) || a[1].name.localeCompare(b[1].name, 'pt-BR'))
                .map(([tnr, t]) => {
                  let w = 0;
                  let d = 0;
                  let l = 0;
                  for (const g of t.games) {
                    if (!wasPlayed(g)) continue;
                    const o = outcomeFor(g, key);
                    if (o === 'win') w++;
                    else if (o === 'draw') d++;
                    else l++;
                  }
                  const tc = timeControlByTnr.get(tnr);
                  const hom = homologatedByTnr.get(tnr);
                  return (
                    <li key={tnr} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/torneios/${tnr}`} className="min-w-0 font-medium hover:underline break-words">
                          {t.name}
                        </Link>
                        <p className="shrink-0 text-sm font-semibold whitespace-nowrap" title="Vitórias / Empates / Derrotas">
                          <span className="text-brand-600 dark:text-brand-400">{w}</span> /{' '}
                          <span className="text-gray-600 dark:text-gray-300">{d}</span> /{' '}
                          <span className="text-red-600 dark:text-red-400">{l}</span>
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(t.date)}
                        {tc && ` · ${tc}`}
                        {hom === true && ' · ✅ homologado'}
                        {hom === false && ' · não homologado'}
                        {` · ${w + d + l} ${w + d + l === 1 ? 'partida' : 'partidas'}`}
                      </p>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800/60">
                {detailGames.slice(0, detailLimit).map((g) => {
                  const opp = g.white.key === key ? g.black : g.white;
                  const tc = timeControlByTnr.get(g.tnr);
                  return (
                    <li key={g.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/jogadores/${opp.key}`} className="font-medium hover:underline break-words">
                          {opp.name}
                        </Link>
                        {detail === 'pgn' && (
                          <span className={cn('shrink-0 text-xs font-semibold', OUTCOME_CLASS[outcomeFor(g, key)])}>
                            {OUTCOME_LABEL[outcomeFor(g, key)]}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <Link href={`/torneios/${g.tnr}`} className="hover:underline">
                          {g.tournament_name}
                        </Link>
                        {` · ${formatDate(g.date)} · Rodada ${g.round} · ${g.white.key === key ? '♔ Brancas' : '♚ Pretas'}`}
                        {tc && ` · ${tc}`}
                      </p>
                      {g.pgn && <GameViewerButton game={g} orientation={g.white.key === key ? 'white' : 'black'} />}
                    </li>
                  );
                })}
              </ul>
              {detailGames.length > detailLimit && (
                <button
                  type="button"
                  onClick={() => setDetailLimit((n) => n + DETAIL_PAGE)}
                  className="mt-3 w-full rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                >
                  mostrar mais ({detailGames.length - detailLimit} restantes)
                </button>
              )}
            </>
          )}
        </section>
      )}

      {opponents.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-xl text-brand-700 dark:text-brand-400 mb-3">
            Adversários ({opponents.length})
          </h2>
          <Select
            label="Ordenar por"
            value={opponentSort}
            onChange={(e) => setOpponentSort(e.target.value as OpponentSort)}
          >
            {OPPONENT_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-2">V / E / D = vitórias, empates e derrotas</p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {sortedOpponents.map((o) => {
              const open = openOpponents.has(o.key);
              const total = o.wins + o.draws + o.losses;
              return (
                <li key={o.key} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/jogadores/${o.key}`}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:underline break-words"
                      >
                        {o.name}
                      </Link>
                      {o.cbx_id && <span className="block text-xs text-gray-400">CBX {o.cbx_id}</span>}
                    </div>
                    <p
                      className="shrink-0 text-sm font-semibold whitespace-nowrap"
                      title="Vitórias / Empates / Derrotas"
                    >
                      <span className="text-brand-600 dark:text-brand-400">{o.wins}</span> /{' '}
                      <span className="text-gray-600 dark:text-gray-300">{o.draws}</span> /{' '}
                      <span className="text-red-600 dark:text-red-400">{o.losses}</span>
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {total} {total === 1 ? 'jogo' : 'jogos'}
                    </span>
                    <span>Último: {formatDate(o.lastDate)}</span>
                    <button
                      type="button"
                      onClick={() => toggleOpponent(o.key)}
                      aria-expanded={open}
                      className="py-1 text-xs font-medium text-brand-700 dark:text-brand-300 underline underline-offset-2"
                    >
                      {open ? 'ocultar jogos' : 'ver jogos'}
                    </button>
                  </div>
                  {open && (
                    <ul className="mt-3 space-y-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
                      {o.games.map((g) => {
                        const outcome = outcomeFor(g, key);
                        const isWhite = g.white.key === key;
                        const tc = timeControlByTnr.get(g.tnr);
                        return (
                          <li key={g.id} className="text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <Link
                                href={`/torneios/${g.tnr}`}
                                className="min-w-0 font-medium hover:underline break-words"
                              >
                                {g.tournament_name}
                              </Link>
                              <span className={cn('shrink-0 text-xs font-semibold', OUTCOME_CLASS[outcome])}>
                                {OUTCOME_LABEL[outcome]}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(g.date)} · Rodada {g.round} · {isWhite ? '♔ Brancas' : '♚ Pretas'}
                              {tc && ` · ${tc}`}
                            </p>
                            {g.pgn && <GameViewerButton game={g} orientation={isWhite ? 'white' : 'black'} />}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section id="partidas" className="space-y-4 scroll-mt-20">
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
                      <div className="shrink-0 flex items-center gap-3">
                        {g.pgn && <GameViewerButton game={g} orientation={isWhite ? 'white' : 'black'} />}
                        <span className={cn('text-xs font-semibold', OUTCOME_CLASS[o])}>{OUTCOME_LABEL[o]}</span>
                      </div>
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

function Stat({
  label,
  value,
  className,
  onClick,
  href,
  active,
}: {
  label: string;
  value: number | string;
  className?: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const body = (
    <>
      <p className={cn('text-2xl font-bold text-gray-900 dark:text-gray-100', className)}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </>
  );
  const base = 'card px-4 py-3 text-center';
  const interactive =
    'block w-full transition-colors hover:border-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600';
  if (href) {
    return (
      <a href={href} className={cn(base, interactive)}>
        {body}
        <span className="text-[11px] font-medium text-brand-700 dark:text-brand-300 underline underline-offset-2">
          ver partidas
        </span>
      </a>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={!!active}
        aria-controls="detalhe"
        className={cn(base, interactive, active && 'border-brand-600 bg-brand-50 dark:bg-brand-950')}
      >
        {body}
        <span className="text-[11px] font-medium text-brand-700 dark:text-brand-300 underline underline-offset-2">
          {active ? 'ocultar' : 'ver detalhes'}
        </span>
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}
