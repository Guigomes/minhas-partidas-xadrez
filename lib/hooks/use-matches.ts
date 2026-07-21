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
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Match, MatchFormValues } from '@/types/match';

const MATCHES_COLLECTION = 'matches';

export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: MatchFormValues) => {
      await addDoc(collection(db, MATCHES_COLLECTION), {
        date: values.date,
        opponent: values.opponent,
        result: values.result,
        color: values.color,
        time_control: values.time_control || null,
        opening: values.opening || null,
        notes: values.notes || null,
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
          time_control: data.time_control ?? null,
          opening: data.opening ?? null,
          notes: data.notes ?? null,
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
