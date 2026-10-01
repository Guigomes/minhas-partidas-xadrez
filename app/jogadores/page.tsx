'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchPlayers } from '@/lib/hooks/use-tournaments';
import { queryTerms } from '@/lib/tournament/player-search';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { player } from '@/lib/config/player';

export default function PlayersPage() {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');

  // Espera a pessoa parar de digitar antes de consultar o Firestore.
  useEffect(() => {
    const t = setTimeout(() => setTerm(input), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data: results, isFetching } = useSearchPlayers(term);
  const hasQuery = queryTerms(term).length > 0;

  return (
    <div className="container-app py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-brand-700 dark:text-brand-400">Jogadores</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Busque qualquer jogador dos torneios importados — pelo nome ou pelo ID CBX / FIDE — e veja contra quem ele
          jogou e os resultados.
        </p>
      </div>

      {player.cbxId && (
        <Link
          href={`/jogadores/cbx-${player.cbxId}`}
          className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          ♟️ Adversários de {player.name}
        </Link>
      )}

      <Input
        label="Nome ou ID"
        placeholder="ex.: Miguel Silva, 107485"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        hint="Pelo menos 3 letras por palavra. Dá pra digitar só parte do nome (ex.: “migu silv”)."
        autoFocus
      />

      {isFetching ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !hasQuery ? null : !results?.length ? (
        <EmptyState icon="🔍" title="Nenhum jogador encontrado" description="Confira a grafia ou tente pelo ID CBX." />
      ) : (
        <ul className="space-y-2">
          {results.map((p) => (
            <li key={p.key}>
              <Link
                href={`/jogadores/${p.key}`}
                className="card flex items-center justify-between gap-3 px-4 py-3 hover:border-brand-400 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {p.title && <span className="text-gold mr-1">{p.title}</span>}
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {p.cbx_id ? `CBX ${p.cbx_id}` : 'sem ID CBX'}
                    {p.rating ? ` · rating ${p.rating}` : ''}
                    {p.club ? ` · ${p.club}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                  {p.tournaments.length} {p.tournaments.length === 1 ? 'torneio' : 'torneios'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
