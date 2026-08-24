'use client';

import { useMemo, useState } from 'react';
import { useImportGames } from '@/lib/hooks/use-import';
import { useBulkCreateMatches, useMatches } from '@/lib/hooks/use-matches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { player } from '@/lib/config/player';
import type { ImportedGame, ImportProvider } from '@/types/match';

const PROVIDERS: { value: ImportProvider; label: string }[] = [
  { value: 'lichess', label: 'Lichess' },
  { value: 'chesscom', label: 'Chess.com' },
  { value: 'chessresults', label: 'Chess-Results (uma ou mais URLs)' },
  { value: 'cbx', label: 'CBX (todos os torneios do jogador)' },
];

const RESULT_LABEL = { win: '🏆 Vitória', loss: '❌ Derrota', draw: '➖ Empate' } as const;

export function MatchImport() {
  const [provider, setProvider] = useState<ImportProvider>('lichess');
  const [username, setUsername] = useState('');
  const [url, setUrl] = useState('');
  const [cbxId, setCbxId] = useState('');
  const [max, setMax] = useState('50');
  const [since, setSince] = useState('');
  const [ratedOnly, setRatedOnly] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const isChessResults = provider === 'chessresults';
  const isCbx = provider === 'cbx';

  const { data: existing } = useMatches();
  const importGames = useImportGames();
  const bulkCreate = useBulkCreateMatches();

  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const m of existing ?? []) {
      if (m.source !== 'manual' && m.source_id) set.add(`${m.source}:${m.source_id}`);
    }
    return set;
  }, [existing]);

  const found = useMemo(() => importGames.data?.games ?? [], [importGames.data]);
  const skipped = importGames.data?.skipped ?? [];
  const newGames = useMemo(
    () => found.filter((g) => !existingKeys.has(`${g.source}:${g.source_id}`)),
    [found, existingKeys]
  );
  const duplicates = found.length - newGames.length;

  const canSearch = isChessResults ? url.trim().length > 0 : isCbx ? cbxId.trim().length > 0 : username.trim().length > 0;

  async function onSearch() {
    setImported(null);
    if (!canSearch) return;
    if (isChessResults) {
      await importGames.mutateAsync({ provider, url: url.trim() });
    } else if (isCbx) {
      await importGames.mutateAsync({ provider, cbxId: cbxId.trim() });
    } else {
      await importGames.mutateAsync({
        provider,
        username: username.trim(),
        max: Number(max) || 50,
        since: since || undefined,
        ratedOnly,
      });
    }
  }

  async function onImport() {
    if (!newGames.length) return;
    const count = await bulkCreate.mutateAsync(newGames);
    setImported(count);
    importGames.reset();
  }

  return (
    <div className="card p-6 sm:p-8 space-y-4">
      <div>
        <h2 className="font-display text-xl text-brand-700 dark:text-brand-400">⬇️ Importar partidas</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Busque suas partidas no Lichess, Chess.com, de um torneio no Chess-Results, ou de todos os torneios de um
          jogador pelo ID da CBX. Nada é gravado até você confirmar.
        </p>
      </div>

      <Select
        label="Provedor"
        value={provider}
        onChange={(e) => {
          setProvider(e.target.value as ImportProvider);
          importGames.reset();
          setImported(null);
        }}
      >
        {PROVIDERS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>

      {isChessResults ? (
        <div>
          <Textarea
            label="URL(s) de torneio no chess-results.com"
            placeholder={`https://chess-results.com/tnr...aspx\nhttps://chess-results.com/tnr...aspx?...&snr=10`}
            rows={4}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cole uma URL por linha — pode ser a página geral do torneio ou a página do jogador. Se a URL não tiver o
            número do jogador (<code>snr</code>), procuramos automaticamente por &quot;{player.fullName}&quot; na
            lista de participantes. Importa os resultados por rodada (sem os lances) como partidas do tipo Torneio.
          </p>
        </div>
      ) : isCbx ? (
        <div>
          <Input
            label="ID CBX do jogador"
            placeholder="107485"
            value={cbxId}
            onChange={(e) => setCbxId(e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Busca todos os torneios do jogador na CBX e procura cada um automaticamente no chess-results, checando o
            nome do jogador na lista de participantes antes de importar. Pode levar alguns segundos. Torneios que não
            forem encontrados com segurança aparecem numa lista separada, pra você buscar manualmente se quiser.
          </p>
        </div>
      ) : (
        <>
          <Input
            label="Usuário"
            placeholder={provider === 'lichess' ? 'seu_usuario_lichess' : 'seu_usuario_chesscom'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Máx. de partidas"
              type="number"
              min={1}
              max={300}
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
            <Input label="Desde (opcional)" type="date" value={since} onChange={(e) => setSince(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={ratedOnly}
              onChange={(e) => setRatedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Somente partidas ranqueadas
          </label>
        </>
      )}

      <Button type="button" className="w-full" onClick={onSearch} loading={importGames.isPending} disabled={!canSearch}>
        {isCbx ? 'Buscar torneios' : 'Buscar partidas'}
      </Button>

      {importGames.isError && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
          {(importGames.error as Error)?.message ?? 'Erro ao buscar partidas.'}
        </p>
      )}

      {imported !== null && (
        <p className="text-sm text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40 rounded-lg px-3 py-2">
          ✅ {imported} {imported === 1 ? 'partida importada' : 'partidas importadas'} com sucesso.
        </p>
      )}

      {importGames.isSuccess && (
        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
          {found.length === 0 && skipped.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma partida encontrada com esses filtros.</p>
          ) : (
            <>
              {found.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {found.length} encontradas
                    </Badge>
                    <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      {newGames.length} novas
                    </Badge>
                    {duplicates > 0 && (
                      <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {duplicates} já importadas
                      </Badge>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {newGames.slice(0, 50).map((g) => (
                      <ImportRow key={`${g.source}:${g.source_id}`} game={g} />
                    ))}
                    {newGames.length > 50 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
                        …e mais {newGames.length - 50} partidas
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    size="lg"
                    onClick={onImport}
                    loading={bulkCreate.isPending}
                    disabled={newGames.length === 0}
                  >
                    {newGames.length > 0 ? `Importar ${newGames.length} novas partidas` : 'Nada novo para importar'}
                  </Button>

                  {bulkCreate.isError && (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                      Não foi possível gravar as partidas. Tente novamente.
                    </p>
                  )}
                </>
              )}

              {skipped.length > 0 && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    {skipped.length} {skipped.length === 1 ? 'torneio não encontrado' : 'torneios não encontrados'} automaticamente:
                  </p>
                  <ul className="space-y-1.5">
                    {skipped.map((s, i) => (
                      <li key={i} className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{s.label}</span> — {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ImportRow({ game }: { game: ImportedGame }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{game.opponent}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {formatDate(game.date)}
          {game.opening ? ` · ${game.opening}` : ''}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-xs font-semibold',
          game.result === 'win' && 'text-brand-600 dark:text-brand-400',
          game.result === 'loss' && 'text-red-600 dark:text-red-400',
          game.result === 'draw' && 'text-gold'
        )}
      >
        {RESULT_LABEL[game.result]}
      </span>
    </div>
  );
}
