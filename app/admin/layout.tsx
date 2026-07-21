'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/use-auth';
import { isAdminEmail } from '@/lib/config/admins';
import { AdminSignOut } from '@/components/layout/admin-sign-out';
import { PageSpinner } from '@/components/ui/spinner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return <PageSpinner />;

  const isAdmin = isAdminEmail(user.email);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="container-app py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Painel
            </Link>
            <span className="text-gray-300 dark:text-gray-700">/</span>
            <span className="text-gray-700 dark:text-gray-300">{isAdmin ? 'Administrador' : 'Visitante'}</span>
          </div>
          <AdminSignOut />
        </div>
      </div>

      <div className="container-app py-8">
        {!isAdmin ? (
          <div className="card p-8 text-center">
            <p className="text-4xl mb-3">🔒</p>
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Acesso restrito</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sua conta ({user.email}) ainda não tem permissão de administrador. Peça para liberar seu acesso em lib/config/admins.ts.
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
