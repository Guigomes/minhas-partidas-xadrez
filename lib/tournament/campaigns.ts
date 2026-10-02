import type { Match } from '@/types/match';

export function score(matches: Pick<Match, 'result'>[]) {
  const wins = matches.filter((m) => m.result === 'win').length;
  const draws = matches.filter((m) => m.result === 'draw').length;
  const points = wins + draws / 2;
  return {
    wins,
    draws,
    losses: matches.length - wins - draws,
    points,
    total: matches.length,
    percent: matches.length ? (points / matches.length) * 100 : 0,
  };
}
export function roundOf(m: Match) {
  return Number(
    m.source_id?.match(/-r(\d+)$/)?.[1] ??
      m.notes?.match(/Rodada\s+(\d+)/i)?.[1] ??
      0
  );
}
export function campaigns(matches: Match[]) {
  const groups = new Map<
    string,
    {
      id: string;
      tnr: string | null;
      name: string;
      date: string;
      matches: Match[];
    }
  >();
  for (const m of matches.filter((m) => m.type === 'tournament')) {
    const tnr =
      m.source === 'chessresults'
        ? (m.source_id?.match(/^(\d+)-/)?.[1] ?? null)
        : null;
    const id = tnr ?? `match-${m.id}`;
    const group = groups.get(id) ?? {
      id,
      tnr,
      name: tnr
        ? m.notes?.split(' · ')[0] || 'Torneio'
        : 'Partida de torneio avulsa',
      date: m.date,
      matches: [],
    };
    group.matches.push(m);
    if (m.date > group.date) group.date = m.date;
    groups.set(id, group);
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      matches: g.matches.sort((a, b) => roundOf(a) - roundOf(b)),
      ...score(g.matches),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export const numberLabel = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
