import type { Metadata, Viewport } from 'next';
import { Inter, Titan_One } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Analytics } from '@vercel/analytics/next';
import { player } from '@/lib/config/player';

const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans' });
const titanOne = Titan_One({ weight: '400', subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: `${player.title} ♟️`,
  description: `Registro pessoal das partidas de xadrez de ${player.name}: resultados, aberturas e estatísticas.`,
  openGraph: {
    type: 'website',
    siteName: player.title,
    title: `${player.title} ♟️`,
    description: `Registro pessoal das partidas de xadrez de ${player.name}: resultados, aberturas e estatísticas.`,
  },
};

export const viewport: Viewport = {
  themeColor: '#6d28d9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${titanOne.variable} font-sans min-h-screen flex flex-col`}>
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
