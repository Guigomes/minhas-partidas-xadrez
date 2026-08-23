'use client';

import { useMemo, useRef, useState } from 'react';
import type { Match, MatchColor } from '@/types/match';

// Cores de status (boa/neutra/crítica) — o resultado de uma partida é
// avaliativo (bom/neutro/ruim), não uma categoria arbitrária, então usamos
// a paleta de status em vez de tons categóricos. Sempre acompanhadas de
// ícone + rótulo, nunca só a cor.
const WIN_COLOR = '#0ca30c';
const DRAW_COLOR = '#898781';
const LOSS_COLOR = '#d03b3b';

type Segment = { key: string; label: string; icon: string; count: number; color: string };

function resultSegments(matches: Match[]): Segment[] {
  const win = matches.filter((m) => m.result === 'win').length;
  const draw = matches.filter((m) => m.result === 'draw').length;
  const loss = matches.filter((m) => m.result === 'loss').length;
  return [
    { key: 'win', label: 'Vitórias', icon: '🏆', count: win, color: WIN_COLOR },
    { key: 'draw', label: 'Empates', icon: '➖', count: draw, color: DRAW_COLOR },
    { key: 'loss', label: 'Derrotas', icon: '❌', count: loss, color: LOSS_COLOR },
  ];
}

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

// Barra empilhada horizontal (parte-todo). O espaçamento entre segmentos
// (flex gap) mostra a cor de fundo do cartão por baixo — é o "surface gap"
// que separa os segmentos sem precisar de borda.
function PartToWholeBar({ segments, showLegend = true }: { segments: Segment[]; showLegend?: boolean }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  const [hovered, setHovered] = useState<string | null>(null);

  if (total === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Sem partidas.</p>;
  }

  const visible = segments.filter((s) => s.count > 0);

  return (
    <div>
      <div className="flex h-7 gap-[2px] rounded-lg overflow-hidden">
        {visible.map((s) => (
          <div
            key={s.key}
            role="img"
            aria-label={`${s.label}: ${s.count} (${pct(s.count, total)}%)`}
            tabIndex={0}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered((h) => (h === s.key ? null : h))}
            onFocus={() => setHovered(s.key)}
            onBlur={() => setHovered((h) => (h === s.key ? null : h))}
            className="relative outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
          >
            {hovered === s.key && (
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-700 px-2 py-1 text-xs text-white shadow-lg">
                <span className="font-semibold">{s.count}</span> {s.label} · {pct(s.count, total)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {segments.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.icon} {s.label} <span className="text-gray-400 dark:text-gray-500">{s.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const COLOR_LABEL: Record<MatchColor, string> = { white: '⚪ Brancas', black: '⚫ Pretas' };

function ColorBreakdown({ matches }: { matches: Match[] }) {
  const byColor = useMemo(() => {
    const result: Record<MatchColor, Match[]> = { white: [], black: [] };
    for (const m of matches) result[m.color].push(m);
    return result;
  }, [matches]);

  return (
    <div className="space-y-5">
      {(['white', 'black'] as const).map((color) => (
        <div key={color}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {COLOR_LABEL[color]} <span className="text-gray-400 dark:text-gray-500 font-normal">({byColor[color].length})</span>
          </p>
          <PartToWholeBar segments={resultSegments(byColor[color])} showLegend={false} />
        </div>
      ))}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {resultSegments(matches).map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.icon} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

type TrendPoint = { key: string; label: string; winRate: number; wins: number; total: number };

function monthlyTrend(matches: Match[]): TrendPoint[] {
  const byMonth = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.date.slice(0, 7); // YYYY-MM
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(m);
  }
  const months = [...byMonth.keys()].sort();

  let cumWins = 0;
  let cumTotal = 0;
  return months.map((key) => {
    const games = byMonth.get(key)!;
    cumWins += games.filter((g) => g.result === 'win').length;
    cumTotal += games.length;
    const [y, mo] = key.split('-');
    const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    return { key, label, winRate: Math.round((cumWins / cumTotal) * 100), wins: cumWins, total: cumTotal };
  });
}

const CHART_W = 320;
const CHART_H = 130;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 20;

function TrendChart({ matches }: { matches: Match[] }) {
  const points = useMemo(() => monthlyTrend(matches), [matches]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Precisa de partidas em pelo menos 2 meses diferentes para mostrar a evolução.
      </p>
    );
  }

  const innerW = CHART_W - PAD_X * 2;
  const innerH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_X + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (winRate: number) => PAD_TOP + innerH - (winRate / 100) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.winRate)}`).join(' ');
  const areaPath = `${linePath} L ${x(points.length - 1)} ${PAD_TOP + innerH} L ${x(0)} ${PAD_TOP + innerH} Z`;

  const last = points[points.length - 1];
  const active = activeIndex !== null ? points[activeIndex] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const i = Math.min(points.length - 1, Math.max(0, Math.round(fraction * (points.length - 1))));
    setActiveIndex(i);
  }

  return (
    <div>
      <div className="relative viz-root">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full h-auto touch-none"
          role="img"
          aria-label={`Taxa de aproveitamento acumulada: começou em ${points[0].winRate}% e está em ${last.winRate}%`}
          onPointerMove={onMove}
          onPointerLeave={() => setActiveIndex(null)}
        >
          {[0, 50, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_X}
                x2={CHART_W - PAD_X}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text x={0} y={y(tick) + 3} fontSize={8} fill="var(--chart-axis)">
                {tick}%
              </text>
            </g>
          ))}

          <path d={areaPath} fill="var(--chart-series-1)" opacity={0.1} stroke="none" />
          <path d={linePath} fill="none" stroke="var(--chart-series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {activeIndex !== null && (
            <line
              x1={x(activeIndex)}
              x2={x(activeIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + innerH}
              stroke="var(--chart-axis)"
              strokeWidth={1}
            />
          )}

          {points.map((p, i) => {
            const isEnd = i === points.length - 1;
            const isActive = i === activeIndex;
            if (!isEnd && !isActive) return null;
            return (
              <circle
                key={p.key}
                cx={x(i)}
                cy={y(p.winRate)}
                r={4}
                fill="var(--chart-series-1)"
                className="stroke-white dark:stroke-gray-900"
                strokeWidth={2}
              />
            );
          })}

          <text x={x(points.length - 1)} y={y(last.winRate) - 8} fontSize={9} textAnchor="end" className="fill-gray-700 dark:fill-gray-300" fontWeight={600}>
            {last.winRate}%
          </text>
        </svg>

        {active && (
          <div className="pointer-events-none absolute top-0 rounded-md bg-gray-900 dark:bg-gray-700 px-2 py-1 text-xs text-white shadow-lg"
            style={{ left: `${(x(activeIndex!) / CHART_W) * 100}%`, transform: 'translate(-50%, -110%)' }}
          >
            <span className="font-semibold">{active.winRate}%</span> em {active.label} · {active.wins}/{active.total} partidas
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Taxa de aproveitamento acumulada, mês a mês. Passe o mouse para ver os detalhes.
      </p>
    </div>
  );
}

function TableToggle({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer select-none text-gray-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400">
        Ver como tabela
      </summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  );
}

function ResultsTable({ matches }: { matches: Match[] }) {
  const segs = resultSegments(matches);
  const total = matches.length;
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="text-gray-500 dark:text-gray-400">
          <th className="py-1 pr-4 font-medium">Resultado</th>
          <th className="py-1 pr-4 font-medium">Partidas</th>
          <th className="py-1 font-medium">%</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 dark:text-gray-300">
        {segs.map((s) => (
          <tr key={s.key} className="border-t border-gray-100 dark:border-gray-800">
            <td className="py-1 pr-4">{s.icon} {s.label}</td>
            <td className="py-1 pr-4 tabular-nums">{s.count}</td>
            <td className="py-1 tabular-nums">{pct(s.count, total)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TrendTable({ matches }: { matches: Match[] }) {
  const points = monthlyTrend(matches);
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="text-gray-500 dark:text-gray-400">
          <th className="py-1 pr-4 font-medium">Mês</th>
          <th className="py-1 pr-4 font-medium">Partidas (acum.)</th>
          <th className="py-1 font-medium">Taxa acum.</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 dark:text-gray-300">
        {points.map((p) => (
          <tr key={p.key} className="border-t border-gray-100 dark:border-gray-800">
            <td className="py-1 pr-4 capitalize">{p.label}</td>
            <td className="py-1 pr-4 tabular-nums">{p.total}</td>
            <td className="py-1 tabular-nums">{p.winRate}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MatchCharts({ matches }: { matches: Match[] }) {
  if (matches.length === 0) return null;

  return (
    <div className="grid gap-4 mb-6 sm:grid-cols-2">
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Resultados</h3>
        <PartToWholeBar segments={resultSegments(matches)} />
        <TableToggle>
          <ResultsTable matches={matches} />
        </TableToggle>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Desempenho por cor</h3>
        <ColorBreakdown matches={matches} />
      </div>

      <div className="card p-5 sm:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Evolução da taxa de aproveitamento</h3>
        <TrendChart matches={matches} />
        <TableToggle>
          <TrendTable matches={matches} />
        </TableToggle>
      </div>
    </div>
  );
}
