import Link from 'next/link';
import { player } from '@/lib/config/player';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 mt-16 bg-brand-950 text-brand-100">
      <div className="container-app py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">♟️</span>
          <span>{player.title} © {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-4">
          <Link href="/" className="hover:text-white transition-colors">
            Partidas
          </Link>
          <Link href="/login" className="hover:text-white transition-colors">
            Área do administrador
          </Link>
        </div>
      </div>
    </footer>
  );
}
