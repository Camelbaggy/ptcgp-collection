import { type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/* ---------- formats ---------- */
export const nf = new Intl.NumberFormat('fr-FR');
export const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
export const pf = (x: number, d = 0) => new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(x);

/* ---------- hooks ---------- */
/** Largeur d'un conteneur, suivie par ResizeObserver. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface Tip { x: number; y: number; node: ReactNode; }
/** Infobulle positionnée dans le conteneur relatif ; se ferme au toucher extérieur. */
export function TipBox({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width * 0.6;
  return (
    <div className="st-tip" role="status" style={{ left: tip.x, top: tip.y, transform: `translate(${flip ? 'calc(-100% - 10px)' : '10px'}, -50%)` }}>
      {tip.node}
    </div>
  );
}
function useDismiss(clear: () => void) {
  useEffect(() => {
    const f = (e: PointerEvent) => { if (!(e.target as Element).closest?.('[data-chart]')) clear(); };
    document.addEventListener('pointerdown', f);
    return () => document.removeEventListener('pointerdown', f);
  }, [clear]);
}

/* ---------- Ring (anneau de progression) ---------- */
export function Ring({ value, size = 96, stroke = 10, label, sub }: { value: number; size?: number; stroke?: number; label: string; sub?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <div className="st-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} : ${pf(v, 1)}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--st-track)" strokeWidth={stroke} />
        <circle className="st-ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--st-accent)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ ['--len' as string]: c }} />
      </svg>
      <div className="st-ring-txt"><b>{pf(v, v < 0.1 ? 1 : 0)}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

/* ---------- Sparkline ---------- */
export function Sparkline({ values, color = 'var(--st-accent)', height = 32, label }: { values: number[]; color?: string; height?: number; label: string }) {
  const id = useId();
  if (values.length < 2) return <div className="st-spark-empty" style={{ height }} aria-hidden />;
  const W = 100, H = height;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg className="st-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={label}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Axes ---------- */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
function ticks(max: number, n = 4): number[] { return Array.from({ length: n + 1 }, (_, i) => (max * i) / n); }

/* ---------- Courbe / aire ---------- */
export interface LinePoint { x: string; y: number; label: string; }
export function AreaChart({ data, ariaLabel, yFormat, yMin, yMax, xTicks, tipValue, height = 200 }: {
  data: LinePoint[]; ariaLabel: string; yFormat: (v: number) => string; yMin?: number; yMax?: number;
  xTicks: { i: number; text: string }[]; tipValue: (p: LinePoint) => string; height?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const id = useId();
  const clear = useCallback(() => { setTip(null); setHi(null); }, []);
  useDismiss(clear);
  const padL = 44, padR = 12, padT = 10, padB = 24;
  const W = Math.max(w, 200), H = height;
  const ys = data.map((d) => d.y);
  const lo = yMin ?? Math.min(...ys), hiV = yMax ?? Math.max(...ys);
  const span = hiV - lo || 1;
  const x = (i: number) => padL + (data.length > 1 ? (i / (data.length - 1)) * (W - padL - padR) : (W - padL - padR) / 2);
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.y).toFixed(1)}`).join(' ');
  const yt = ticks(span, 4).map((t) => lo + t);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - padL) / (W - padL - padR)) * (data.length - 1))));
    setHi(i);
    setTip({ x: x(i), y: Math.max(30, y(data[i].y)), node: <><b>{tipValue(data[i])}</b><span>{data[i].label}</span></> });
  };
  return (
    <div ref={ref} className="st-chart" data-chart>
      {w > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType === 'mouse') clear(); }} style={{ touchAction: 'pan-y' }}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--st-accent)" stopOpacity=".32" /><stop offset="1" stopColor="var(--st-accent)" stopOpacity="0" /></linearGradient></defs>
          {yt.map((t) => (
            <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="st-gl" /><text x={padL - 8} y={y(t) + 4} textAnchor="end" className="st-axis">{yFormat(t)}</text></g>
          ))}
          {xTicks.map((t) => <text key={t.i} x={x(t.i)} y={H - 6} textAnchor={t.i === 0 ? 'start' : t.i === data.length - 1 ? 'end' : 'middle'} className="st-axis">{t.text}</text>)}
          {data.length > 1 && <path d={`${line} L${x(data.length - 1)} ${H - padB} L${x(0)} ${H - padB} Z`} fill={`url(#${id})`} />}
          <path className="st-draw" d={line} fill="none" stroke="var(--st-accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
          {hi !== null && <g><line x1={x(hi)} x2={x(hi)} y1={padT} y2={H - padB} className="st-cursor" /><circle cx={x(hi)} cy={y(data[hi].y)} r="5" fill="var(--st-accent)" stroke="var(--st-surface)" strokeWidth="2" /></g>}
        </svg>
      )}
      <TipBox tip={tip} width={W} />
    </div>
  );
}

/* ---------- Colonnes (simples ou empilées) ---------- */
export interface BarDatum { label: string; tipLabel: string; values: number[]; }
export function Columns({ data, series, ariaLabel, xTicks, height = 190, unit = '' }: {
  data: BarDatum[]; series: { name: string; color: string }[]; ariaLabel: string; xTicks: { i: number; text: string }[]; height?: number; unit?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const clear = useCallback(() => { setTip(null); setHi(null); }, []);
  useDismiss(clear);
  const padL = 34, padR = 8, padT = 10, padB = 24;
  const W = Math.max(w, 200), H = height;
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const max = niceMax(Math.max(1, ...totals));
  const bw = (W - padL - padR) / Math.max(1, data.length);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const gap = Math.min(4, bw * 0.2);
  const show = (i: number) => {
    setHi(i);
    setTip({
      x: padL + i * bw + bw / 2, y: Math.max(34, y(totals[i])),
      node: <><b>{data[i].tipLabel}</b>{series.length > 1
        ? series.map((s, k) => <span key={s.name}><i className="st-dot" style={{ background: s.color }} />{s.name} : {nf.format(data[i].values[k])}</span>)
        : <span>{nf.format(totals[i])} {unit}</span>}</>,
    });
  };
  return (
    <div ref={ref} className="st-chart" data-chart>
      {w > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onPointerLeave={(e) => { if (e.pointerType === 'mouse') clear(); }}>
          {ticks(max, 4).map((t) => (
            <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="st-gl" /><text x={padL - 6} y={y(t) + 4} textAnchor="end" className="st-axis">{nf.format(Math.round(t))}</text></g>
          ))}
          {xTicks.map((t) => <text key={t.i} x={padL + t.i * bw + bw / 2} y={H - 6} textAnchor={t.i === 0 ? 'start' : t.i === data.length - 1 ? 'end' : 'middle'} className="st-axis">{t.text}</text>)}
          {data.map((d, i) => {
            let acc = 0;
            return (
              <g key={i} onPointerEnter={() => show(i)} onPointerDown={() => show(i)} opacity={hi === null || hi === i ? 1 : 0.55}>
                <rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent" />
                {d.values.map((v, k) => {
                  if (v <= 0) return null;
                  const y0 = y(acc), y1 = y(acc + v); acc += v;
                  const top = k === d.values.length - 1 || d.values.slice(k + 1).every((q) => q <= 0);
                  return <rect key={k} className="st-grow" x={padL + i * bw + gap / 2} y={y1} width={Math.max(1, bw - gap)} height={Math.max(0, y0 - y1)} rx={top ? Math.min(3, bw / 2) : 0} fill={series[k].color} style={{ transformOrigin: `0 ${y0}px` }} />;
                })}
              </g>
            );
          })}
        </svg>
      )}
      <TipBox tip={tip} width={W} />
    </div>
  );
}

/* ---------- Donut ---------- */
export interface Slice { key: string; label: string; value: number; color: string; extra?: string; }
export function Donut({ slices, ariaLabel, centerTop, centerBottom, size = 180 }: { slices: Slice[]; ariaLabel: string; centerTop: string; centerBottom: string; size?: number }) {
  const [hi, setHi] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 14, c = 2 * Math.PI * r, stroke = 24;
  let acc = 0;
  const cur = slices.find((s) => s.key === hi);
  return (
    <div className="st-donut" data-chart onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHi(null); }}>
      <div className="st-donut-fig" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--st-track)" strokeWidth={stroke} />
          {slices.map((s) => {
            const len = total ? (s.value / total) * c : 0, off = acc; acc += len;
            const gap = slices.length > 1 && len > 3 ? 2 : 0;
            return (
              <circle key={s.key} className="st-slice" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={hi === s.key ? stroke + 4 : stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`} opacity={hi && hi !== s.key ? 0.4 : 1}
                onPointerEnter={() => setHi(s.key)} onPointerDown={() => setHi(s.key)}><title>{`${s.label} : ${nf.format(s.value)}`}</title></circle>
            );
          })}
        </svg>
        <div className="st-donut-c">{cur ? <><b>{nf.format(cur.value)}</b><small>{cur.label}</small><small>{pf(total ? cur.value / total : 0, 1)}</small></> : <><b>{centerTop}</b><small>{centerBottom}</small></>}</div>
      </div>
      <ul className="st-legend">
        {slices.map((s) => (
          <li key={s.key} className={hi === s.key ? 'on' : ''} onPointerEnter={() => setHi(s.key)} onPointerDown={() => setHi(s.key)}>
            <i className="st-dot" style={{ background: s.color }} /><span className="n">{s.label}</span><span className="v">{nf.format(s.value)}{s.extra ? <small> {s.extra}</small> : null}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Jauge de chance ---------- */
export function LuckMeter({ percentile, verdict }: { percentile: number; verdict: string }) {
  const W = 260, H = 150, cx = W / 2, cy = 128, r = 100;
  const pt = (p: number, rr = r) => { const a = Math.PI * (1 - p); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const; };
  const arc = (p0: number, p1: number) => { const [x0, y0] = pt(p0), [x1, y1] = pt(p1); return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`; };
  const p = Math.max(0, Math.min(100, percentile)) / 100;
  const [nx, ny] = pt(p, r - 14);
  const zones = [[0, 0.1, 'var(--st-bad)'], [0.1, 0.35, 'var(--st-warn)'], [0.35, 0.65, 'var(--st-mid)'], [0.65, 0.9, 'var(--st-good2)'], [0.9, 1, 'var(--st-good)']] as const;
  return (
    <div className="st-luck">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 320 }} role="img" aria-label={`Chance : mieux que ${Math.round(percentile)} % des joueurs théoriques. ${verdict}.`}>
        {zones.map(([a, b, col]) => <path key={a} d={arc(a + 0.004, b - 0.004)} stroke={col} strokeWidth="16" fill="none" />)}
        <line className="st-needle" x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--st-text)" strokeWidth="3" strokeLinecap="round" style={{ ['--rot' as string]: `${(p - 0.5) * 180}deg`, transformOrigin: `${cx}px ${cy}px` }} />
        <circle cx={cx} cy={cy} r="7" fill="var(--st-text)" />
        <text x={cx - r} y={cy + 18} textAnchor="middle" className="st-axis">Malchance</text>
        <text x={cx + r} y={cy + 18} textAnchor="middle" className="st-axis">Veine</text>
      </svg>
      <div className="st-luck-v"><b>{verdict}</b><small>mieux que {nf.format(Math.round(percentile))} % des joueurs</small></div>
    </div>
  );
}

/* ---------- Barre empilée horizontale (HTML, pour accueillir logos) ---------- */
export function StackBar({ parts, total }: { parts: { color: string; value: number; label: string }[]; total: number }) {
  return (
    <div className="st-stack" role="img" aria-label={parts.map((p) => `${p.label} ${nf.format(p.value)}`).join(', ')}>
      {parts.map((p) => p.value > 0 && <i key={p.label} className="st-grow-x" style={{ width: `${(p.value / Math.max(1, total)) * 100}%`, background: p.color }} title={`${p.label} : ${nf.format(p.value)}`} />)}
    </div>
  );
}

/** Carte de section avec titre, sous-titre, contenu et insight. */
export function Section({ title, sub, insight, children, wide, className }: { title: string; sub?: string; insight?: ReactNode; children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <section className={'st-card' + (wide ? ' wide' : '') + (className ? ' ' + className : '')}>
      <header><h2>{title}</h2>{sub && <p>{sub}</p>}</header>
      <div className="st-body">{children}</div>
      {insight && <footer className="st-insight"><span aria-hidden>💡</span><span>{insight}</span></footer>}
    </section>
  );
}
export const Empty = ({ children }: { children: ReactNode }) => <p className="st-empty">{children}</p>;
