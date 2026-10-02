'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { player as me } from '@/lib/config/player';
import { myMatchesFrom } from '@/lib/tournament/my-matches';
import { queryTerms, searchTokens } from '@/lib/tournament/player-search';
import type { ParsedTournament, PlayerProfile, Tournament, TournamentGame } from '@/types/tournament';

const TOURNAMENTS = 'tournaments';
const GAMES = 'tournament_games';
const PLAYERS = 'players';

// Firestore limita cada writeBatch a 500 operações; deixamos folga.
const BATCH_SIZE = 450;

type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;

async function commitInChunks(ops: BatchOp[]) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH_SIZE)) op(batch);
    await batch.commit();
  }
}

// Só grava campos com valor: um torneio sem a coluna "ID FIDE" não pode
// apagar o FIDE que veio de outro torneio do mesmo jogador.
function withoutNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

export function useFetchTournament() {
  return useMutation({
    mutationFn: async (url: string): Promise<ParsedTournament> => {
      const res = await fetch(`/api/tournament?url=${encodeURIComponent(url)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? 'Não foi possível buscar o torneio.');
      return body as ParsedTournament;
    },
  });
}

// Grava (ou regrava) o torneio inteiro. Os IDs dos documentos são
// determinísticos (tnr, tnr+rodada+jogadores, chave do jogador), então
// importar de novo o mesmo torneio atualiza em vez de duplicar.
export function useSaveTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: ParsedTournament) => {
      const ops: BatchOp[] = [];

      const meta: Tournament = {
        tnr: t.tnr,
        name: t.name,
        date: t.date,
        url: t.url,
        rounds: t.rounds,
        player_count: t.player_count,
        game_count: t.game_count,
        cbx_id_count: t.cbx_id_count,
        homologated: t.homologated ?? null,
        time_control: t.time_control ?? null,
      };
      ops.push((b) => b.set(doc(db, TOURNAMENTS, t.tnr), { ...meta, imported_at: serverTimestamp() }));

      for (const g of t.games) {
        // A data pode ter sido corrigida na prévia.
        ops.push((b) => b.set(doc(db, GAMES, g.id), { ...g, date: t.date, tournament_name: t.name }));
      }

      for (const p of t.players) {
        ops.push((b) =>
          b.set(
            doc(db, PLAYERS, p.key),
            {
              ...withoutNulls({
                key: p.key,
                name: p.name,
                title: p.title,
                cbx_id: p.cbx_id,
                fide_id: p.fide_id,
                federation: p.federation,
                rating: p.rating,
                club: p.club,
              }),
              search_tokens: searchTokens(p.name, [p.cbx_id, p.fide_id]),
              tournaments: arrayUnion(t.tnr),
              updated_at: serverTimestamp(),
            },
            { merge: true }
          )
        );
      }

      // Partidas do jogador configurado também vão pra lista principal
      // (página inicial), sem duplicar as que já foram importadas.
      let myMatches = 0;
      if (me.cbxId) {
        const mine = myMatchesFrom(t, me.cbxId, me.fullName);
        if (mine.length) {
          const existing = await getDocs(query(collection(db, 'matches'), where('source', '==', 'chessresults')));
          const known = new Set(existing.docs.map((d) => d.data().source_id as string));
          for (const g of mine.filter((g) => !known.has(g.source_id))) {
            myMatches++;
            ops.push((b) =>
              b.set(doc(collection(db, 'matches')), {
                date: g.date,
                opponent: g.opponent,
                result: g.result,
                color: g.color,
                type: 'tournament',
                time_control: g.time_control ?? null,
                opening: null,
                notes: g.notes ?? null,
                pgn: null,
                source: g.source,
                source_id: g.source_id,
                homologated: g.homologated ?? null,
                created_at: serverTimestamp(),
              })
            );
          }
        }
      }

      await commitInChunks(ops);
      return { games: t.games.length, players: t.players.length, myMatches };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournaments'] });
      qc.invalidateQueries({ queryKey: ['players'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: async (): Promise<Tournament[]> => {
      const snapshot = await getDocs(collection(db, TOURNAMENTS));
      return snapshot.docs
        .map((d) => d.data() as Tournament)
        .sort((a, b) => b.date.localeCompare(a.date));
    },
  });
}

// Remove as partidas do torneio e o tnr da lista de torneios de cada jogador.
// Os documentos de jogador ficam (podem ter outros torneios).
export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tnr: string) => {
      const games = await getDocs(query(collection(db, GAMES), where('tnr', '==', tnr)));
      const playerKeys = new Set<string>();
      const ops: BatchOp[] = [];
      for (const d of games.docs) {
        const g = d.data() as TournamentGame;
        g.player_keys.forEach((k) => playerKeys.add(k));
        ops.push((b) => b.delete(d.ref));
      }
      for (const key of playerKeys) {
        ops.push((b) => b.update(doc(db, PLAYERS, key), { tournaments: arrayRemove(tnr) }));
      }
      ops.push((b) => b.delete(doc(db, TOURNAMENTS, tnr)));
      await commitInChunks(ops);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournaments'] });
      qc.invalidateQueries({ queryKey: ['players'] });
    },
  });
}

function toProfile(data: Record<string, unknown>): PlayerProfile {
  return {
    key: data.key as string,
    name: data.name as string,
    title: (data.title as string) ?? null,
    cbx_id: (data.cbx_id as string) ?? null,
    fide_id: (data.fide_id as string) ?? null,
    federation: (data.federation as string) ?? null,
    rating: (data.rating as number) ?? null,
    club: (data.club as string) ?? null,
    tournaments: (data.tournaments as string[]) ?? [],
  };
}

const SEARCH_LIMIT = 50;

// Busca por nome (qualquer parte, a partir de 3 letras por palavra) ou por
// ID CBX / FIDE. O Firestore só permite um array-contains por consulta: usa
// o termo mais longo (o mais seletivo) e filtra os demais no cliente.
export function useSearchPlayers(input: string) {
  const terms = queryTerms(input);
  return useQuery({
    queryKey: ['players', 'search', terms.join(' ')],
    enabled: terms.length > 0,
    queryFn: async (): Promise<PlayerProfile[]> => {
      const main = [...terms].sort((a, b) => b.length - a.length)[0];
      const snapshot = await getDocs(
        query(collection(db, PLAYERS), where('search_tokens', 'array-contains', main), limit(SEARCH_LIMIT))
      );
      return snapshot.docs
        .map((d) => d.data())
        .filter((data) => terms.every((t) => (data.search_tokens as string[]).includes(t)))
        .map(toProfile)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
  });
}

export function usePlayer(key: string) {
  return useQuery({
    queryKey: ['players', 'profile', key],
    enabled: !!key,
    queryFn: async (): Promise<PlayerProfile | null> => {
      const snap = await getDoc(doc(db, PLAYERS, key));
      return snap.exists() ? toProfile(snap.data()) : null;
    },
  });
}

export function usePlayerGames(key: string) {
  return useQuery({
    queryKey: ['players', 'games', key],
    enabled: !!key,
    queryFn: async (): Promise<TournamentGame[]> => {
      const snapshot = await getDocs(
        query(collection(db, GAMES), where('player_keys', 'array-contains', key))
      );
      return snapshot.docs
        .map((d) => d.data() as TournamentGame)
        .sort((a, b) => b.date.localeCompare(a.date) || b.tnr.localeCompare(a.tnr) || a.round - b.round);
    },
  });
}

export function useTournament(tnr: string) {
  return useQuery({
    queryKey: ['tournaments', tnr],
    enabled: !!tnr,
    queryFn: async (): Promise<Tournament | null> => {
      const snap = await getDoc(doc(db, TOURNAMENTS, tnr));
      return snap.exists() ? (snap.data() as Tournament) : null;
    },
  });
}

export function useTournamentGames(tnr: string) {
  return useQuery({
    queryKey: ['tournaments', tnr, 'games'],
    enabled: !!tnr,
    queryFn: async (): Promise<TournamentGame[]> => {
      const snapshot = await getDocs(query(collection(db, GAMES), where('tnr', '==', tnr)));
      return snapshot.docs
        .map((d) => d.data() as TournamentGame)
        .sort((a, b) => a.round - b.round || a.white.snr - b.white.snr);
    },
  });
}

// Todos os inscritos do torneio, inclusive quem ainda não tem partida.
export function useTournamentPlayers(tnr: string) {
  return useQuery({
    queryKey: ['tournaments', tnr, 'players'],
    enabled: !!tnr,
    queryFn: async (): Promise<PlayerProfile[]> => {
      const snapshot = await getDocs(query(collection(db, PLAYERS), where('tournaments', 'array-contains', tnr)));
      return snapshot.docs.map((d) => toProfile(d.data()));
    },
  });
}
