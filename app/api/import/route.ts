import { NextResponse } from 'next/server';
import { fetchLichessGames } from '@/lib/import/lichess';
import { fetchChessComGames } from '@/lib/import/chesscom';
import { fetchChessResultsGames } from '@/lib/import/chessresults';
import { importFromCbx } from '@/lib/import/cbx';
import type { ImportProvider } from '@/types/match';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_GAMES_CAP = 300;

function parseError(error: unknown): { status: number; message: string } {
  if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
    return { status: Number((error as { status: number }).status), message: String((error as { message: string }).message) };
  }
  return { status: 500, message: 'Erro inesperado ao importar as partidas.' };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') as ImportProvider | null;

  if (provider !== 'lichess' && provider !== 'chesscom' && provider !== 'chessresults' && provider !== 'cbx') {
    return NextResponse.json({ message: 'Provedor inválido.' }, { status: 400 });
  }

  try {
    // CBX: descobre os torneios do jogador na CBX e cruza cada um com o
    // chess-results automaticamente (sem precisar colar URL nenhuma).
    if (provider === 'cbx') {
      const cbxId = searchParams.get('cbxId')?.trim();
      if (!cbxId) {
        return NextResponse.json({ message: 'Informe o ID CBX do jogador.' }, { status: 400 });
      }
      const { games, skipped } = await importFromCbx(cbxId);
      return NextResponse.json({ games, skipped });
    }

    // chess-results é baseado em URL da ficha do jogador, não em usuário.
    if (provider === 'chessresults') {
      const url = searchParams.get('url')?.trim();
      if (!url) {
        return NextResponse.json({ message: 'Informe a URL da ficha do jogador no chess-results.' }, { status: 400 });
      }
      const games = await fetchChessResultsGames({ url });
      return NextResponse.json({ games });
    }

    const username = searchParams.get('username')?.trim();
    if (!username) {
      return NextResponse.json({ message: 'Informe o nome de usuário.' }, { status: 400 });
    }

    const maxParam = Number(searchParams.get('max') ?? '100');
    const max = Number.isFinite(maxParam) ? Math.min(Math.max(Math.trunc(maxParam), 1), MAX_GAMES_CAP) : 100;

    const sinceParam = searchParams.get('since'); // YYYY-MM-DD
    const since = sinceParam ? new Date(`${sinceParam}T00:00:00Z`).getTime() : undefined;
    const ratedOnly = searchParams.get('rated') === 'true';

    const games =
      provider === 'lichess'
        ? await fetchLichessGames({ username, max, since, ratedOnly })
        : await fetchChessComGames({ username, max, since, ratedOnly });

    return NextResponse.json({ games });
  } catch (error) {
    const { status, message } = parseError(error);
    return NextResponse.json({ message }, { status });
  }
}
