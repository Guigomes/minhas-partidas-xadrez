import { NextResponse } from 'next/server';
import { fetchFullTournament } from '@/lib/import/chessresults-tournament';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function parseError(error: unknown): { status: number; message: string } {
  if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
    return { status: Number((error as { status: number }).status), message: String((error as { message: string }).message) };
  }
  return { status: 500, message: 'Erro inesperado ao importar o torneio.' };
}

// Busca um torneio inteiro do chess-results (todos os jogadores e partidas)
// e devolve normalizado. Não grava nada: quem grava é o cliente, depois da
// prévia, com a sessão do administrador (as regras do Firestore protegem).
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url')?.trim();
  if (!url) {
    return NextResponse.json({ message: 'Informe a URL do torneio no chess-results.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await fetchFullTournament(url));
  } catch (error) {
    const { status, message } = parseError(error);
    return NextResponse.json({ message }, { status });
  }
}
