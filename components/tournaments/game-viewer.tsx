'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/spinner';
import type { TournamentGame } from '@/types/tournament';

// chess.js só entra no bundle quando alguém abre uma partida.
const PgnBoard = dynamic(() => import('@/components/matches/pgn-board').then((m) => m.PgnBoard), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-16">
      <Spinner className="h-8 w-8" />
    </div>
  ),
});

const RESULT_TEXT: Record<TournamentGame['result'], string> = {
  '1-0': '1 - 0',
  '0-1': '0 - 1',
  '1/2-1/2': '½ - ½',
  '+-': '1 - 0 (W.O.)',
  '-+': '0 - 1 (W.O.)',
  '--': 'W.O. duplo',
};

// Botão "ver lances" que abre o tabuleiro navegável de uma partida com PGN.
// `orientation`: lado que fica embaixo (o do jogador da página, quando há um).
export function GameViewerButton({
  game,
  orientation = 'white',
  className,
}: {
  game: TournamentGame;
  orientation?: 'white' | 'black';
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!game.pgn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'py-1 text-xs font-medium text-brand-700 dark:text-brand-300 underline underline-offset-2'
        }
      >
        ♟ ver lances
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Partida ${game.white.name} contra ${game.black.name}`}
        >
          <div
            className="card w-full max-w-lg p-4 sm:p-6 border-t-4 border-t-brand-500 shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 break-words">
                  ♔ {game.white.name} <span className="text-gray-400">x</span> ♚ {game.black.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 break-words">
                  {RESULT_TEXT[game.result]} · Rodada {game.round} · {game.tournament_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 py-1 text-sm font-medium text-brand-700 dark:text-brand-300 underline underline-offset-2"
              >
                fechar
              </button>
            </div>
            <div className="mt-4">
              <PgnBoard pgn={game.pgn} orientation={orientation} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
