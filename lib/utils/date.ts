import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: ptBR });
}

export function formatLongDate(date: string): string {
  return formatDate(date, "EEEE, dd 'de' MMMM 'de' yyyy");
}

export function timeAgo(date: string): string {
  return formatDistanceToNow(parseISO(date), { locale: ptBR, addSuffix: true });
}
