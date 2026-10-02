import type { Tournament } from '@/types/tournament';
import { normalizeText } from './player-search';

// Festivais e campeonatos por categoria viram vários torneios (um por categoria)
// com o mesmo nome e a mesma data. Para listas e totais, agrupa em "eventos".
export type TournamentEvent = {
  key: string;
  name: string;
  date: string;
  tournaments: Tournament[];
  players: number;
  games: number;
  timeControls: string[];
  homologated: boolean | null | 'mixed';
};

// Chave do evento: data + nome sem a parte que identifica a categoria.
function eventKey(t: Tournament): string {
  const base = normalizeText(t.name.split(' — ')[0])
    .replace(/\[(std|rpd|blz)\]/g, ' ')
    .replace(/\b(sub|u)[ -]?\d+[a-z]?\b/g, ' ')
    .replace(/\bs\d{1,2}\b/g, ' ')
    .replace(/\b\d{2} e \d{2}\b/g, ' ')
    .replace(/\b(masculino|feminino|masc|fem|absoluto|misto|livre|geral)\b/g, ' ')
    .replace(/\bserie [a-e]\b/g, ' ')
    .replace(/id (cbx|do torneio)\s*\d+(\/\d+)?/g, ' ')
    .replace(/\b\d{3,6}\/\d{2}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return `${t.date}|${base}`;
}

// Nome do evento: as palavras que todas as categorias têm em comum, no começo do nome.
function eventName(list: Tournament[]): string {
  if (list.length === 1) return list[0].name.split(' — ')[0];
  const split = list.map((t) => t.name.split(' — ')[0].split(/\s+/));
  const common: string[] = [];
  for (let i = 0; i < split[0].length; i++) {
    const w = split[0][i];
    if (split.every((s) => s[i]?.toLowerCase() === w.toLowerCase())) common.push(w);
    else break;
  }
  while (common.length && /^(-|–|—|sub|u\d*|id|\[.*\])$/i.test(common[common.length - 1])) common.pop();
  return common.length >= 2 ? common.join(' ') : split[0].join(' ');
}

export function groupEvents(tournaments: Tournament[]): TournamentEvent[] {
  const map = new Map<string, Tournament[]>();
  for (const t of tournaments) map.set(eventKey(t), [...(map.get(eventKey(t)) ?? []), t]);
  return [...map.entries()]
    .map(([key, list]) => {
      const hom = new Set(list.map((t) => t.homologated ?? null));
      return {
        key,
        name: eventName(list),
        date: list[0].date,
        tournaments: list,
        players: list.reduce((s, t) => s + t.player_count, 0),
        games: list.reduce((s, t) => s + t.game_count, 0),
        timeControls: [...new Set(list.map((t) => t.time_control).filter((x): x is NonNullable<typeof x> => !!x))],
        homologated: hom.size === 1 ? [...hom][0] : ('mixed' as const),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'pt-BR'));
}
