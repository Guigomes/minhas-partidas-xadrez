'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateMatch } from '@/lib/hooks/use-matches';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

function matchErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') {
    return 'Você não tem permissão para registrar partidas. Verifique se está logado com a conta correta.';
  }
  if (code) {
    return `Não foi possível salvar a partida (${code}). Tente novamente.`;
  }
  return 'Não foi possível salvar a partida. Tente novamente.';
}

const matchSchema = z.object({
  date: z.string().min(1, 'Informe a data'),
  opponent: z.string().trim().min(2, 'Informe o nome do adversário'),
  result: z.enum(['win', 'loss', 'draw']),
  color: z.enum(['white', 'black']),
  time_control: z.string().trim().max(50).optional(),
  opening: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

type MatchValues = z.infer<typeof matchSchema>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

const RESULT_OPTIONS = [
  { value: 'win', label: '🏆 Vitória' },
  { value: 'draw', label: '➖ Empate' },
  { value: 'loss', label: '❌ Derrota' },
] as const;

const COLOR_OPTIONS = [
  { value: 'white', label: '⚪ Brancas' },
  { value: 'black', label: '⚫ Pretas' },
] as const;

export function MatchForm() {
  const createMatch = useCreateMatch();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<MatchValues>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      date: today(),
      opponent: '',
      result: 'win',
      color: 'white',
      time_control: '',
      opening: '',
      notes: '',
    },
  });

  const result = watch('result');
  const color = watch('color');

  async function onSubmit(values: MatchValues) {
    await createMatch.mutateAsync(values);
    reset({ date: today(), opponent: '', result: 'win', color: 'white', time_control: '', opening: '', notes: '' });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card p-6 sm:p-8 space-y-4">
      <h2 className="font-display text-xl text-brand-700 dark:text-brand-400">♟️ Registrar partida</h2>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Data" type="date" error={errors.date?.message} {...register('date')} />
        <Input
          label="Adversário"
          placeholder="Nome do adversário"
          error={errors.opponent?.message}
          {...register('opponent')}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Resultado</label>
        <div className="grid grid-cols-3 gap-3">
          {RESULT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('result', opt.value)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors',
                result === opt.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-300'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Cor</label>
        <div className="grid grid-cols-2 gap-3">
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('color', opt.value)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors',
                color === opt.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-300'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Controle de tempo" error={errors.time_control?.message} {...register('time_control')}>
          <option value="">Não informado</option>
          <option value="Bullet">Bullet</option>
          <option value="Blitz">Blitz</option>
          <option value="Rápido">Rápido</option>
          <option value="Clássico">Clássico</option>
        </Select>
        <Input
          label="Abertura"
          placeholder="Ex: Siciliana"
          error={errors.opening?.message}
          {...register('opening')}
        />
      </div>

      <Textarea
        label="Notas (opcional)"
        placeholder="Observações sobre a partida..."
        error={errors.notes?.message}
        {...register('notes')}
      />

      {createMatch.isError && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
          {matchErrorMessage(createMatch.error)}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" loading={createMatch.isPending}>
        Salvar partida
      </Button>
    </form>
  );
}
