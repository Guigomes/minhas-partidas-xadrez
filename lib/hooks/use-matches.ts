'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ImportedGame, Match, MatchFormValues, MatchSource, MatchType } from '@/types/match';

const MATCHES_COLLECTION = 'matches';

// Firestore limita cada writeBatch a 500 operações; deixamos folga.
const BATCH_SIZE = 450;

// Partidas gravadas antes do campo `type` derivam o tipo da origem.
function deriveType(data: { type?: MatchType; source?: MatchSource }): MatchType {
  if (data.type) return data.type;
  if (data.source === 'lichess' || data.source === 'chesscom') return data.source;
  return 'manual';
}

export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: MatchFormValues) => {
      await addDoc(collection(db, MATCHES_COLLECTION), {
        date: values.date,
        opponent: values.opponent,
        result: values.result,
        color: values.color,
        type: values.type,
        time_control: values.time_control || null,
        opening: values.opening || null,
        notes: values.notes || null,
        pgn: null,
        source: 'manual',
        source_id: null,
        created_at: serverTimestamp(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: async (): Promise<Match[]> => {
      const snapshot = await getDocs(
        query(collection(db, MATCHES_COLLECTION), orderBy('date', 'desc'))
      );
      return snapshot.docs.map((d) => {
        const data = d.data();
        const createdAt = data.created_at instanceof Timestamp ? data.created_at.toDate() : new Date();
        return {
          id: d.id,
          date: data.date,
          opponent: data.opponent,
          result: data.result,
          color: data.color,
          type: deriveType(data),
          time_control: data.time_control ?? null,
          opening: data.opening ?? null,
          notes: data.notes ?? null,
          pgn: data.pgn ?? null,
          source: data.source ?? 'manual',
          source_id: data.source_id ?? null,
          created_at: createdAt.toISOString(),
        };
      });
    },
  });
}

export type MatchEditValues = MatchFormValues;

export function useUpdateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: MatchEditValues }) => {
      await updateDoc(doc(db, MATCHES_COLLECTION, id), {
        date: values.date,
        opponent: values.opponent,
        result: values.result,
        color: values.color,
        type: values.type,
        time_control: values.time_control || null,
        opening: values.opening || null,
        notes: values.notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useDeleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, MATCHES_COLLECTION, id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useBulkCreateMatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (games: ImportedGame[]) => {
      for (let i = 0; i < games.length; i += BATCH_SIZE) {
        const chunk = games.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const g of chunk) {
          const ref = doc(collection(db, MATCHES_COLLECTION));
          batch.set(ref, {
            date: g.date,
            opponent: g.opponent,
            result: g.result,
            color: g.color,
            type: g.source,
            time_control: g.time_control ?? null,
            opening: g.opening ?? null,
            notes: null,
            pgn: g.pgn ?? null,
            source: g.source,
            source_id: g.source_id,
            created_at: serverTimestamp(),
          });
        }
        await batch.commit();
      }
      return games.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}
