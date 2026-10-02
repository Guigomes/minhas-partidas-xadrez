'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMatches } from '@/lib/hooks/use-matches';
import { usePlayerGames, useTournaments } from '@/lib/hooks/use-tournaments';
import { ChessInsights } from '@/components/tournaments/chess-insights';
import { MatchSummary } from '@/components/matches/match-summary';
import { MatchCharts } from '@/components/matches/match-charts';
import { MatchTable } from '@/components/matches/match-table';
import { CampaignList } from '@/components/tournaments/campaign-list';
import { campaigns, numberLabel, score } from '@/lib/tournament/campaigns';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSpinner } from '@/components/ui/spinner';
import { player } from '@/lib/config/player';
import { isAdminEmail } from '@/lib/config/admins';
import { useUser } from '@/lib/hooks/use-auth';
import { formatDate } from '@/lib/utils/date';

export default function HomePage() {
  const { data: matches, isLoading, isError, refetch } = useMatches();
  const { data: games } = usePlayerGames(`cbx-${player.cbxId}`);
  const { data: tournaments } = useTournaments();
  const { user } = useUser();
  // Online (Chess.com / Lichess) e partidas avulsas só para o admin logado;
  // os demais veem só a base de torneios. Regra só no front: os dados
  // continuam legíveis no Firestore.
  const isAdmin = isAdminEmail(user?.email);
  const [selectedMode, setMode] = useState('tournament');
  const mode = isAdmin ? selectedMode : 'tournament';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modality, setModality] = useState('');
  const invalidDates = !!from && !!to && from > to;
  const visible = useMemo(
    () =>
      (matches ?? []).filter((m) => {
        const category =
          m.type === 'tournament'
            ? 'tournament'
            : m.type === 'manual'
              ? 'manual'
              : 'online';
        return (
          category === mode &&
          (!from || m.date >= from) &&
          (!to || m.date <= to) &&
          (!modality || m.time_control === modality)
        );
      }),
    [matches, mode, from, to, modality]
  );
  const groups = useMemo(() => campaigns(visible), [visible]);
  const latest = groups[0];
  return (
    <div>
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="board-pattern absolute inset-0 opacity-30" />
        <div className="container-app relative py-8 sm:py-12">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-200">
            Minha trajetória no xadrez
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            {player.fullName}
          </h1>
          <p className="mt-3 max-w-xl text-brand-100">
            Torneios, resultados e evolução a cada partida.
          </p>
          <Link
            href={`/jogadores/cbx-${player.cbxId}`}
            className="mt-5 inline-block text-sm font-medium text-brand-100 underline underline-offset-4"
          >
            Conheça meus adversários e confrontos →
          </Link>
        </div>
      </section>
      <div className="container-app space-y-7 py-8">
        {isAdmin && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Contexto das partidas"
        >
          {[
            ['tournament', 'Torneios'],
            ['online', 'Online'],
            ['manual', 'Outras partidas'],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-full px-5 py-3 text-sm font-semibold ${mode === value ? 'bg-brand-700 text-white' : 'bg-white text-gray-600 dark:bg-gray-900 dark:text-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
        )}
        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-semibold">
            Filtrar período e modalidade
            {from || to || modality
              ? ` · ${from ? formatDate(from) : 'Início'} até ${to ? formatDate(to) : 'hoje'} · ${modality || 'Todas'}`
              : ' · Todo o histórico'}
          </summary>
          <section className="mt-4" aria-label="Filtros de todo o painel">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Desde"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input
                label="Até"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <Select
                label="Modalidade"
                value={modality}
                onChange={(e) => setModality(e.target.value)}
              >
                <option value="">Todas as modalidades</option>
                {['Clássico', 'Rápido', 'Blitz', 'Bullet'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
              <p>
                O período e a modalidade se aplicam a todos os resultados
                abaixo.
              </p>
              <button
                className="text-brand-700 underline dark:text-brand-300"
                onClick={() => {
                  setFrom('');
                  setTo('');
                  setModality('');
                }}
              >
                Limpar filtros
              </button>
            </div>
          </section>
        </details>
        {invalidDates ? (
          <p role="alert">
            A data final deve ser igual ou posterior à inicial.
          </p>
        ) : isLoading ? (
          <PageSpinner />
        ) : isError ? (
          <div className="card p-6" role="alert">
            Não foi possível carregar as partidas.{' '}
            <button className="underline" onClick={() => refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            {mode === 'tournament' && latest && (
              <section className="card border-l-4 border-l-brand-600 p-6 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  Último torneio no período
                </p>
                <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                  {latest.name}
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(latest.date)} ·{' '}
                  {latest.matches[0].time_control || 'Modalidade não informada'}
                </p>
                <p className="mt-5 text-4xl font-bold tabular-nums">
                  {numberLabel(latest.points)}
                  <span className="text-xl font-normal text-gray-500">
                    {' '}
                    / {latest.total} pontos
                  </span>
                </p>
                <p className="mt-2 text-sm">
                  {latest.wins} vitórias · {latest.draws} empates ·{' '}
                  {latest.losses} derrotas nas partidas registradas.
                </p>
                {latest.total >= 2 && latest.wins === latest.total && (
                  <p className="mt-4 font-semibold text-yellow-800 dark:text-yellow-300">
                    Sequência perfeita registrada: {latest.wins} vitórias em{' '}
                    {latest.total} partidas.
                  </p>
                )}
                <a
                  href="#campanhas"
                  className="mt-5 inline-block text-sm font-semibold text-brand-700 dark:text-brand-300"
                >
                  Ver as rodadas ↓
                </a>
              </section>
            )}
            <section aria-label="Resumo do período">
              <h2 className="mb-4 text-xl font-bold">
                {from || to ? 'Resumo do período' : 'Resumo do histórico'}
              </h2>
              <MatchSummary matches={visible} />
              {mode === 'tournament' && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {groups.filter((g) => g.tnr).length} torneios identificados ·
                  Pontos de partidas jogadas, sem byes e W.O.
                </p>
              )}
            </section>
            {visible.length > 0 && (
              <section>
                <h2 className="mb-4 text-xl font-bold">
                  Desempenho por modalidade
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ...new Set(
                      visible.map((m) => m.time_control || 'Não informada')
                    ),
                  ].map((name) => {
                    const s = score(
                      visible.filter(
                        (m) => (m.time_control || 'Não informada') === name
                      )
                    );
                    return (
                      <div className="card p-5" key={name}>
                        <h3 className="font-semibold">{name}</h3>
                        <p className="mt-2 text-2xl font-bold">
                          {numberLabel(s.percent)}%
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {numberLabel(s.points)} pontos em {s.total} partidas
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {mode === 'tournament' && groups.length > 0 && (
              <section className="card p-5">
                <h2 className="text-xl font-bold">Evolução por torneio</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Aproveitamento nas partidas registradas. Compare também
                  modalidade e número de jogos.
                </p>
                <div className="mt-5 space-y-4">
                  {[...groups].reverse().map((g) => (
                    <div key={g.id}>
                      <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                        <span>
                          {formatDate(g.date)} · {g.name} ·{' '}
                          {g.matches[0].time_control ||
                            'Modalidade não informada'}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {numberLabel(g.percent)}% · {g.total} jogos
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-2 rounded-full bg-brand-600"
                          style={{ width: `${g.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <MatchCharts matches={visible} showTrend={mode !== 'tournament'} />
            {mode === 'tournament' && (
              <ChessInsights
                matches={visible}
                games={games ?? []}
                tournaments={tournaments ?? []}
                playerKey={`cbx-${player.cbxId}`}
              />
            )}
            {mode === 'tournament' ? (
              <section id="campanhas" className="scroll-mt-20">
                <h2 className="mb-4 text-xl font-bold">
                  Campanhas por torneio
                </h2>
                <CampaignList matches={visible} />
              </section>
            ) : (
              <section>
                <h2 className="mb-4 text-xl font-bold">Partidas</h2>
                <MatchTable matches={visible} hideDateFilters />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
