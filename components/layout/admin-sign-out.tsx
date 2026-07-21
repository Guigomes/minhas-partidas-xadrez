'use client';

import { useRouter } from 'next/navigation';
import { useSignOut } from '@/lib/hooks/use-auth';

export function AdminSignOut() {
  const router = useRouter();
  const signOut = useSignOut();

  return (
    <button
      onClick={async () => {
        await signOut.mutateAsync();
        router.push('/');
      }}
      className="text-red-600 dark:text-red-400 hover:underline"
    >
      Sair
    </button>
  );
}
