'use client';

import Link from 'next/link';
import { player } from '@/lib/config/player';
import { useUser } from '@/lib/hooks/use-auth';
import { isAdminEmail } from '@/lib/config/admins';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function Header() {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/90">
      <div className="container-app flex h-16 items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 font-display text-brand-700 dark:text-brand-400">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-brand-600 text-white shadow-sm text-lg">
            ♟️
          </span>
          <span className="hidden sm:inline font-bold tracking-tight">{player.name} · Xadrez</span>
        </Link>

        <div className="flex items-center gap-0 sm:gap-2">
          {isAdminEmail(user?.email) && (
            <Link
              href="/miguel"
              className="rounded-lg px-2 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            >
              Miguel
            </Link>
          )}
          <Link
            href="/torneios"
            className="rounded-lg px-2 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            Torneios
          </Link>
          <Link
            href="/jogadores"
            className="rounded-lg px-2 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            Jogadores
          </Link>
          <ThemeToggle />
          {user ? (
            <Link
              href="/admin"
              className="rounded-lg px-2 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:underline"
            >
              Painel
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg px-2 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:underline"
            >
              Admin
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
