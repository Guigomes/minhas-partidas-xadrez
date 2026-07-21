'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useDeleteMatch, useUpdateMatch, type MatchEditValues } from '@/lib/hooks/use-matches';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import type { Match, MatchColor, MatchType } from '@/types/match';

// chess.js só entra no bundle quando o usuário abre o tabuleiro.
const PgnBoard = dynamic(() => import('./pgn-board').then((m) => m.PgnBoard), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-16">
      <Spinner className="h-8 w-8" />
    </div>
  ),
});

type SortKey = 'date' | 'opponent' | 'result';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Data' },
  { key: 'opponent', label: 'Adversário' },
  { key: 'result', label: 'Resultado' },
];

const RESULT_LABEL: Record<Match['result'], string> = {
  win: '🏆 Vitória',
  loss: '❌ Derrota',
  draw: '➖ Empate',
};

const RESULT_BADGE_CLASS: Record<Match['result'], string> = {
  win: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  loss: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  draw: 'bg-gold/20 text-yellow-700 dark:bg-gold/10 dark:text-gold',
};

const RESULT_ORDER: Record<Match['result'], number> = { win: 0, draw: 1, loss: 2 };

const TYPE_LABEL: Record<MatchType, string> = {
  tournament: '🏆 Torneio',
  lichess: 'Lichess',
  chesscom: 'Chess.com',
  manual: 'Manual',
};

const TYPE_ORDER: MatchType[] = ['tournament', 'lichess', 'chesscom', 'manual'];

const TYPE_OPTIONS: { value: MatchType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'tournament', label: 'Torneio' },
  { value: 'lichess', label: 'Lichess' },
  { value: 'chesscom', label: 'Chess.com' },
];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-300'
          : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
      )}
    >
      {children}
    </button>
  );
}

function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onEscape();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEscape]);
}

function DeleteConfirmModal({
  match,
  pending,
  onCancel,
  onConfirm,
}: {
  match: Match;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEscapeKey(onCancel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => !pending && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-label={`Remover partida contra ${match.opponent}`}
    >
      <div className="card w-full max-w-sm p-6 text-center border-t-4 border-t-red-500 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-4xl mb-3">🗑️</p>
        <h3 className="font-display text-xl text-gray-900 dark:text-gray-100 mb-1">Remover partida?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          A partida contra <span className="font-semibold text-gray-900 dark:text-gray-100">{match.opponent}</span>
          {' '}vai ser removida da lista.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-5">Essa ação não pode ser desfeita.</p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={pending}>
            Remover
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditMatchModal({
  match,
  pending,
  onCancel,
  onSave,
}: {
  match: Match;
  pending: boolean;
  onCancel: () => void;
  onSave: (values: MatchEditValues) => void;
}) {
  const [date, setDate] = useState(match.date);
  const [opponent, setOpponent] = useState(match.opponent);
  const [result, setResult] = useState<Match['result']>(match.result);
  const [color, setColor] = useState<Match['color']>(match.color);
  const [type, setType] = useState<Match['type']>(match.type);
  const [timeControl, setTimeControl] = useState(match.time_control ?? '');
  const [opening, setOpening] = useState(match.opening ?? '');
  const [notes, setNotes] = useState(match.notes ?? '');

  useEscapeKey(onCancel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={() => !pending && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-label={`Editar partida contra ${match.opponent}`}
    >
      <div className="card w-full max-w-md p-6 border-t-4 border-t-brand-500 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <p className="text-4xl text-center mb-3">✏️</p>
        <h3 className="font-display text-xl text-gray-900 dark:text-gray-100 mb-5 text-center">Editar partida</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Adversário" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resultado</p>
            <div className="grid grid-cols-3 gap-2">
              {(['win', 'draw', 'loss'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResult(r)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                    result === r
                      ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-300'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
                  )}
                >
                  {RESULT_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cor</p>
            <div className="grid grid-cols-2 gap-2">
              {(['white', 'black'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                    color === c
                      ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-300'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
                  )}
                >
                  {c === 'white' ? '⚪ Brancas' : '⚫ Pretas'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as Match['type'])}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Select label="Controle de tempo" value={timeControl} onChange={(e) => setTimeControl(e.target.value)}>
              <option value="">Não informado</option>
              <option value="Bullet">Bullet</option>
              <option value="Blitz">Blitz</option>
              <option value="Rápido">Rápido</option>
              <option value="Clássico">Clássico</option>
            </Select>
          </div>

          <Input label="Abertura" value={opening} onChange={(e) => setOpening(e.target.value)} />

          <Textarea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSave({ date, opponent, result, color, type, time_control: timeControl, opening, notes })}
            loading={pending}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

function PgnBoardModal({ pgn, orientation, onClose }: { pgn: string; orientation: MatchColor; onClose: () => void }) {
  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Tabuleiro da partida"
    >
      <div className="card w-full max-w-md p-5 sm:p-6 border-t-4 border-t-brand-500 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg text-gray-900 dark:text-gray-100">♟️ Tabuleiro</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <PgnBoard pgn={pgn} orientation={orientation} />
      </div>
    </div>
  );
}

function PgnDisclosure({ pgn, orientation }: { pgn: string; orientation: MatchColor }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // navegador sem acesso à área de transferência — ignora
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setBoardOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
        >
          ♟️ Abrir no tabuleiro
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
        >
          <span>{open ? '▼' : '▶'}</span>
          {open ? 'Ocultar PGN' : 'Ver PGN'}
        </button>
      </div>

      {boardOpen && <PgnBoardModal pgn={pgn} orientation={orientation} onClose={() => setBoardOpen(false)} />}

      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
          <div className="flex items-center justify-end border-b border-gray-200 dark:border-gray-800 px-2 py-1">
            <button
              type="button"
              onClick={copy}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <pre className="max-h-56 overflow-auto p-3 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono">
            {pgn}
          </pre>
        </div>
      )}
    </div>
  );
}

export function MatchTable({ matches, editable = false }: { matches: Match[]; editable?: boolean }) {
  const deleteMatch = useDeleteMatch();
  const updateMatch = useUpdateMatch();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [typeFilter, setTypeFilter] = useState<MatchType | 'all'>('all');
  const [toDelete, setToDelete] = useState<Match | null>(null);
  const [toEdit, setToEdit] = useState<Match | null>(null);

  function confirmDelete() {
    if (!toDelete) return;
    deleteMatch.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
  }

  function saveEdit(values: MatchEditValues) {
    if (!toEdit) return;
    updateMatch.mutate({ id: toEdit.id, values }, { onSuccess: () => setToEdit(null) });
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return [...matches].sort((a, b) => b.date.localeCompare(a.date));

    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...matches].sort((a, b) => {
      switch (sortKey) {
        case 'date':
          return dir * a.date.localeCompare(b.date);
        case 'opponent':
          return dir * a.opponent.localeCompare(b.opponent, 'pt-BR');
        case 'result':
          return dir * (RESULT_ORDER[a.result] - RESULT_ORDER[b.result]);
        default:
          return 0;
      }
    });
  }, [matches, sortKey, sortDirection]);

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<MatchType, number>> = {};
    for (const m of matches) counts[m.type] = (counts[m.type] ?? 0) + 1;
    return counts;
  }, [matches]);

  const visible = useMemo(
    () => (typeFilter === 'all' ? sorted : sorted.filter((m) => m.type === typeFilter)),
    [sorted, typeFilter]
  );

  const availableTypes = TYPE_ORDER.filter((t) => (typeCounts[t] ?? 0) > 0);

  if (!matches.length) {
    return (
      <EmptyState
        icon="♟️"
        title="Nenhuma partida registrada"
        description="Assim que as partidas forem registradas, elas aparecerão aqui."
      />
    );
  }

  return (
    <div>
      {availableTypes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tipo:</span>
          <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
            Todos <span className="opacity-60">{matches.length}</span>
          </FilterChip>
          {availableTypes.map((t) => (
            <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {TYPE_LABEL[t]} <span className="opacity-60">{typeCounts[t]}</span>
            </FilterChip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ordenar por:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => toggleSort(opt.key)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              sortKey === opt.key
                ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-300'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
            )}
          >
            {opt.label}
            {sortKey === opt.key && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          Nenhuma partida deste tipo.
        </p>
      ) : (
      <div className="space-y-3">
        {visible.map((m) => (
          <div key={m.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{m.opponent}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(m.date)}</p>
              </div>
              {editable && (
                <div className="shrink-0 flex items-center gap-3">
                  <button onClick={() => setToEdit(m)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => setToDelete(m)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                    Remover
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className={RESULT_BADGE_CLASS[m.result]}>{RESULT_LABEL[m.result]}</Badge>
              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {m.color === 'white' ? '⚪ Brancas' : '⚫ Pretas'}
              </Badge>
              {m.time_control && (
                <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{m.time_control}</Badge>
              )}
              {m.opening && (
                <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{m.opening}</Badge>
              )}
              <Badge className="bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                {TYPE_LABEL[m.type]}
              </Badge>
            </div>

            {m.notes && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">{m.notes}</p>
            )}

            {m.pgn && <PgnDisclosure pgn={m.pgn} orientation={m.color} />}
          </div>
        ))}
      </div>
      )}

      {toDelete && (
        <DeleteConfirmModal
          match={toDelete}
          pending={deleteMatch.isPending}
          onCancel={() => !deleteMatch.isPending && setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {toEdit && (
        <EditMatchModal
          match={toEdit}
          pending={updateMatch.isPending}
          onCancel={() => !updateMatch.isPending && setToEdit(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}
