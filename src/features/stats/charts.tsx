import { monthLabel } from '../dashboard/format';

export interface HBarItem { label: string; value: number; max: number; value2?: number; text?: string; color?: string; }

/** Barres horizontales (valeur / max) avec une seconde barre fine optionnelle. */
export function HBars({ items, ariaLabel }: { items: HBarItem[]; ariaLabel: string }) {
  const rowH = 30, labelW = 72, valW = 64, W = 360;
  const barW = W - labelW - valW;
  return (
    <svg className="ptc-chart" role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${items.length * rowH + 4}`} width="100%">
      {items.map((it, i) => {
        const y = i * rowH + 2;
        const w1 = it.max > 0 ? Math.max(0, Math.min(1, it.value / it.max)) * barW : 0;
        const w2 = it.value2 !== undefined && it.max > 0 ? Math.max(0, Math.min(1, it.value2 / it.max)) * barW : 0;
        return (
          <g key={it.label}>
            <text x={0} y={y + 14}>{it.label}</text>
            <rect x={labelW} y={y + 4} width={barW} height={14} rx={4} fill="var(--c-border)" />
            <rect x={labelW} y={y + 4} width={w1} height={14} rx={4} fill={it.color ?? 'var(--c-accent)'} />
            {it.value2 !== undefined && <rect x={labelW} y={y + 18} width={w2} height={4} rx={2} fill="var(--c-text)" opacity={0.55} />}
            <text className="val" x={W} y={y + 15} textAnchor="end">{it.text ?? ''}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Colonnes verticales (packs par mois). */
export function Columns({ data, ariaLabel }: { data: { month: string; count: number }[]; ariaLabel: string }) {
  const W = 360, H = 150, pad = 22, bottom = 26;
  const max = Math.max(1, ...data.map((d) => d.count));
  const bw = (W - 2 * pad) / Math.max(1, data.length);
  const step = Math.ceil(data.length / 8);
  return (
    <svg className="ptc-chart" role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} width="100%">
      <line x1={pad} x2={W - pad} y1={H - bottom} y2={H - bottom} stroke="var(--c-border)" />
      {data.map((d, i) => {
        const h = (d.count / max) * (H - bottom - 18);
        const x = pad + i * bw;
        return (
          <g key={d.month}>
            <rect x={x + bw * 0.15} y={H - bottom - h} width={bw * 0.7} height={h} rx={3} fill="var(--c-accent)" />
            {data.length <= 16 && <text className="val" x={x + bw / 2} y={H - bottom - h - 3} textAnchor="middle">{d.count}</text>}
            {i % step === 0 && <text x={x + bw / 2} y={H - 10} textAnchor="middle">{monthLabel(d.month)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Rapport réel / espéré : 1 = conforme, barre centrée sur 1 (échelle 0..2). */
export function RatioBars({ items, ariaLabel }: { items: { label: string; ratio: number; text: string }[]; ariaLabel: string }) {
  const rowH = 30, labelW = 56, W = 360, valW = 96;
  const barW = W - labelW - valW;
  const mid = labelW + barW / 2;
  return (
    <svg className="ptc-chart" role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${items.length * rowH + 4}`} width="100%">
      <line x1={mid} x2={mid} y1={0} y2={items.length * rowH + 4} stroke="var(--c-muted)" strokeDasharray="3 3" />
      {items.map((it, i) => {
        const y = i * rowH + 2;
        const r = Math.max(0, Math.min(2, it.ratio));
        const x = Math.min(mid, labelW + (r / 2) * barW);
        const w = Math.abs(labelW + (r / 2) * barW - mid);
        return (
          <g key={it.label}>
            <text x={0} y={y + 15}>{it.label}</text>
            <rect x={x} y={y + 4} width={w} height={14} rx={3} fill={it.ratio >= 1 ? 'var(--c-accent)' : 'var(--c-muted)'} />
            <text className="val" x={W} y={y + 15} textAnchor="end">{it.text}</text>
          </g>
        );
      })}
    </svg>
  );
}
