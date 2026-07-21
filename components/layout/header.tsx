'use client';

import Link from 'next/link';
import { player } from '@/lib/config/player';
import { useUser } from '@/lib/hooks/use-auth';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function Header() {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/90">
      <div className="container-app flex h-14 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-display text-brand-700 dark:text-brand-400">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-brand-600 text-white shadow-sm text-lg">
            ♟️
          </span>
          <span className="hidden sm:inline tracking-wide">{player.title}</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link
              href="/admin"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Painel
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
