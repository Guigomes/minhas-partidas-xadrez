'use client';

import { cn } from '@/lib/utils/cn';
import type { Match } from '@/types/match';

// Primeira escolha da página inicial: de onde são as partidas. Quase nunca
// se misturam, então cada modo mostra só as suas estatísticas.
export type Mode = 'tournament' | 'online';

export const MODES: { value: Mode; label: string; icon: string; hint: string }[] = [
  { value: 'tournament', label: 'Torneio', icon: '🏆', hint: 'Partidas de torneios' },
  { value: 'online', label: 'Chess.com', icon: '♟️', hint: 'Chess.com, Lichess e manuais' },
];

export function modeOf(match: Match): Mode {
  return match.type === 'tournament' ? 'tournament' : 'online';
}

export function ModeSwitch({
  mode,
  onChange,
  counts,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
  counts: Record<Mode, number>;
}) {
  return (
    <div role="tablist" aria-label="Tipo de partida" className="grid grid-cols-2 gap-3 mb-8">
      {MODES.map((m) => {
        const active = m.value === mode;
        return (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.value)}
            className={cn(
              'rounded-xl border-2 px-4 py-4 text-left transition-colors',
              active
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-950 dark:border-brand-500'
                : 'border-gray-200 hover:border-brand-400 dark:border-gray-800'
            )}
          >
            <span className="block text-2xl" aria-hidden="true">
              {m.icon}
            </span>
            <span
              className={cn(
                'block font-display text-lg mt-1',
                active ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-gray-100'
              )}
            >
              {m.label}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {counts[m.value]} {counts[m.value] === 1 ? 'partida' : 'partidas'} · {m.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
