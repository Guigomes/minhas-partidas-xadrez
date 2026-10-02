'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useDeleteTournament,
  useFetchTournament,
  useSaveTournament,
  useTournaments,
} from '@/lib/hooks/use-tournaments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/date';
import type { ParsedTournament } from '@/types/tournament';

type Fetched =
  | { url: string; status: 'ok'; tournament: ParsedTournament; saved: boolean; myMatches?: number }
  | { url: string; status: 'error'; message: string };

export function TournamentImport() {
  const [urls, setUrls] = useState('');
  const [items, setItems] = useState<Fetched[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTournament = useFetchTournament();
  const saveTournament = useSaveTournament();
  const deleteTournament = useDeleteTournament();
  const { data: imported } = useTournaments();

  const importedTnrs = useMemo(() => new Set((imported ?? []).map((t) => t.tnr)), [imported]);

  // Um torneio por requisição: cada um já custa 2 páginas no chess-results,
  // e assim um torneio com erro não derruba os outros.
  async function onSearch() {
    const list = urls.split(/\r?\n/).map((u) => u.trim()).filter(Boolean);
    if (!list.length) return;
    setLoading(true);
    setItems([]);
    const results: Fetched[] = [];
    for (const url of list) {
      try {
        const tournament = await fetchTournament.mutateAsync(url);
        results.push({ url, status: 'ok', tournament, saved: false });
      } catch (error) {
        results.push({ url, status: 'error', message: (error as Error).message });
      }
      setItems([...results]);
    }
    setLoading(false);
  }

  function updateDate(index: number, date: string) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index && it.status === 'ok' ? { ...it, tournament: { ...it.tournament, date, date_exact: true } } : it
      )
    );
  }

  function updateHomologated(index: number, homologated: boolean) {
    setItems((prev) =>
      prev.map((it, i) => (i === index && it.status === 'ok' ? { ...it, tournament: { ...it.tournament, homologated } } : it))
    );
  }

  async function onSave(index: number) {
    const it = items[index];
    if (it?.status !== 'ok') return;
    const { myMatches } = await saveTournament.mutateAsync(it.tournament);
    setItems((prev) => prev.map((x, i) => (i === index && x.status === 'ok' ? { ...x, saved: true, myMatches } : x)));
  }

  async function onDelete(tnr: string, name: string) {
    if (!window.confirm(`Remover "${name}" e todas as partidas dele?`)) return;
    await deleteTournament.mutateAsync(tnr);
  }

  return (
    <div className="card p-6 sm:p-8 space-y-4">
      <div>
        <h2 className="font-display text-xl text-brand-700 dark:text-brand-400">🏆 Importar torneio completo</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Grava <strong>todas</strong> as partidas do torneio (quem jogou contra quem e o resultado), não só as suas —
          base da página{' '}
          <Link href="/jogadores" className="underline">
            Jogadores
          </Link>
          . Cada jogador é identificado pelo ID
          CBX quando o torneio publica (coluna &quot;ID&quot; da lista de jogadores). Nada é gravado até você confirmar.
        </p>
      </div>

      <div>
        <Textarea
          label="URL(s) de torneio no chess-results.com"
          placeholder={'https://chess-results.com/tnr1404686.aspx\nhttps://chess-results.com/tnr1469979.aspx'}
          rows={3}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Uma URL por linha. Em torneios divididos em grupos/categorias, cada grupo tem a própria URL (tnr). Torneios
          por equipes não são suportados.
        </p>
      </div>

      <Button type="button" className="w-full" onClick={onSearch} loading={loading} disabled={!urls.trim()}>
        Buscar torneio(s)
      </Button>

      {items.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
          {items.map((it, i) =>
            it.status === 'error' ? (
              <p
                key={i}
                className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 break-all"
              >
                {it.url} — {it.message}
              </p>
            ) : (
              <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{it.tournament.name}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {it.tournament.player_count} jogadores
                    </Badge>
                    <Badge
                      className={
                        it.tournament.cbx_id_count > 0
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                          : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300'
                      }
                    >
                      {it.tournament.cbx_id_count} com ID CBX
                    </Badge>
                    <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {it.tournament.game_count} partidas · {it.tournament.rounds} rodadas
                    </Badge>
                    {importedTnrs.has(it.tournament.tnr) && (
                      <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        já importado (salvar de novo atualiza)
                      </Badge>
                    )}
                  </div>
                </div>

                {it.tournament.cbx_id_count === 0 && (
                  <p className="text-xs text-yellow-800 dark:text-yellow-300">
                    Esse torneio não publica o ID CBX: os jogadores serão identificados pelo FIDE ID ou pelo nome, e
                    não se ligam automaticamente aos mesmos jogadores em outros torneios com ID.
                  </p>
                )}
                {it.tournament.game_count === 0 && (
                  <p className="text-xs text-yellow-800 dark:text-yellow-300">
                    Nenhuma partida publicada ainda (torneio não começou?). Só os jogadores serão gravados.
                  </p>
                )}

                <Input
                  label="Data do torneio"
                  type="date"
                  value={it.tournament.date}
                  onChange={(e) => updateDate(i, e.target.value)}
                  hint={
                    it.tournament.date_exact
                      ? undefined
                      : 'O chess-results esconde a data de início de torneios antigos — essa é a da última atualização da página. Confira.'
                  }
                />

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={it.tournament.homologated === true}
                    onChange={(e) => updateHomologated(i, e.target.checked)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  Torneio homologado (vale rating)
                </label>

                <Button
                  type="button"
                  className="w-full"
                  onClick={() => onSave(i)}
                  loading={saveTournament.isPending && saveTournament.variables?.tnr === it.tournament.tnr}
                  disabled={it.saved}
                >
                  {it.saved
                    ? `✅ Salvo${it.myMatches ? ` · ${it.myMatches} partidas suas na lista principal` : ''}`
                    : `Salvar ${it.tournament.game_count} partidas e ${it.tournament.player_count} jogadores`}
                </Button>
              </div>
            )
          )}

          {saveTournament.isError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
              Não foi possível gravar o torneio. {(saveTournament.error as Error)?.message}
            </p>
          )}
        </div>
      )}

      {(imported?.length ?? 0) > 0 && (
        <details className="border-t border-gray-200 dark:border-gray-800 pt-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            {imported!.length} {imported!.length === 1 ? 'torneio importado' : 'torneios importados'}
          </summary>
          <ul className="mt-3 space-y-2">
            {imported!.map((t) => (
              <li
                key={t.tnr}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2"
              >
                <div className="min-w-0">
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block hover:underline"
                  >
                    {t.name}
                  </a>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(t.date)} · {t.player_count} jogadores · {t.game_count} partidas ·{' '}
                    {t.homologated === true ? 'homologado' : t.homologated === false ? 'não homologado' : 'homologação não informada'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(t.tnr, t.name)}
                  loading={deleteTournament.isPending && deleteTournament.variables === t.tnr}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
