'use client';

import { useMutation } from '@tanstack/react-query';
import type { ImportedGame, ImportProvider } from '@/types/match';

export type ImportParams = {
  provider: ImportProvider;
  username: string;
  max: number;
  since?: string;
  ratedOnly?: boolean;
};

export function useImportGames() {
  return useMutation({
    mutationFn: async (params: ImportParams): Promise<ImportedGame[]> => {
      const query = new URLSearchParams({
        provider: params.provider,
        username: params.username,
        max: String(params.max),
      });
      if (params.since) query.set('since', params.since);
      if (params.ratedOnly) query.set('rated', 'true');

      const res = await fetch(`/api/import?${query}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message ?? 'Não foi possível importar as partidas.');
      }
      return (body.games ?? []) as ImportedGame[];
    },
  });
}
