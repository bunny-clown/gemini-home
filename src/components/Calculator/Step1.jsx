import { useState, useMemo, useCallback, useRef } from 'react';
import { buildSavingsTimeline, fmtCurrency, fmtMonthLabel, addMonths, CLOSING_PCT } from '../../utils/calculations';
import MonthPicker from '../Common/MonthPicker';
import SliderRow from '../Common/SliderRow';
import Stat from '../Common/Stat';
import { useApp } from '../../contexts/AppContext';
import CurrencyInput from '../Common/CurrencyInput';

const today = new Date();
const DEFAULT_START = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

const DEFAULT = {
  initialSavings: 42000,
  startMonth: DEFAULT_START,
  monthlyContrib: 4200,
  projectionMonths: 24,
  downPct: 20,
  heatmapPriceMin: 500000,
  heatmapPriceMax: 850000,
  heatmapPriceIncrement: 50000,
  overrides: {},
};

// ── Editable contribution cell ──────────────────────────────────────────────
function EditableContrib({ contrib, monthIdx, onOverride }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const startEdit = () => {
    setDraft(String(contrib));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const v = parseFloat(draft);
    if (!isNaN(v) && v >= 0) onOverride(monthIdx, v);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className="ar-input"
        style={{ width: 90, padding: '2px 6px', fontSize: 13 }}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        onBlur={commit}
      />
    );
  }

  return (
    <span
      style={{ borderBottom: '1px dashed var(--ar-muted)', cursor: 'pointer' }}
      title="Click to override"
      onClick={startEdit}
    >
      {fmtCurrency(contrib)}
    </span>
  );
}

// ── Savings curve SVG ───────────────────────────────────────────────────────
function SavingsCurve({ data, startMonth, downPct, selectedMonthIdx, onOverride }) {
  const [popup, setPopup] = useState(null); // idx

  const w = 520, h = 240, padBottom = 24;
  const chartH = h - padBottom;

  const handleSelectMonth = (idx) => {
    setPopup(popup === idx ? null : idx);
  };

  if (!data?.length) return null;

  const max = Math.max(...data.map(d => d.balance));
  const points = data.map((d, i) => [
    (i / Math.max(data.length - 1, 1)) * w,
    chartH - (d.balance / Math.max(max, 1)) * (chartH - 20) - 10,
  ]);

  const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = path + ' L' + w + ',' + chartH + ' L0,' + chartH + ' Z';

  const labelStep = Math.max(1, Math.round(data.length / Math.min(data.length, 5)));
  const labelIndices = [];
  for (let i = 0; i < data.length; i += labelStep) labelIndices.push(i);
  if (labelIndices[labelIndices.length - 1] !== data.length - 1) labelIndices.push(data.length - 1);

  const selectedPoint = selectedMonthIdx != null ? selectedMonthIdx : popup;
  const popupData = popup != null ? data[popup] : null;
  const maxHomePrice = popupData
    ? Math.floor(popupData.balance / ((downPct + CLOSING_PCT) / 100) / 1000) * 1000
    : 0;

  // Popup position as % of SVG dimensions, clamped so it stays inside
  const popupPt = popup != null ? points[popup] : null;
  const popupLeft = popupPt ? `${Math.min(Math.max((popupPt[0] / w) * 100, 2), 52)}%` : '0%';
  const popupTop  = popupPt ? `${Math.min(Math.max((popupPt[1] / h) * 100 + 4, 2), 55)}%` : '0%';

  return (
    <div className="ar-savings-chart" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 180 }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: '100%', height: '100%', cursor: 'pointer', display: 'block', position: 'absolute', inset: 0 }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="s1-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ar-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--ar-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map(p => (
          <line key={p} x1="0" x2={w} y1={chartH * p} y2={chartH * p}
            stroke="rgba(0,0,0,0.05)" strokeDasharray="2,4" />
        ))}

        <path d={area} fill="url(#s1-grad)" />
        <path d={path} stroke="var(--ar-accent)" strokeWidth="2" fill="none" strokeLinecap="round" />

        {points.map((p, i) => {
          const isSel = i === selectedPoint;
          return (
            <g key={i} onClick={() => handleSelectMonth(i)} style={{ cursor: 'pointer' }}>
              <circle cx={p[0]} cy={p[1]} r={12} fill="transparent" />
              {isSel ? (
                <>
                  <circle cx={p[0]} cy={p[1]} r={8} fill="var(--ar-accent)" opacity="0.25" />
                  <circle cx={p[0]} cy={p[1]} r={5} fill="var(--ar-accent)" />
                  <circle cx={p[0]} cy={p[1]} r={5} stroke="white" strokeWidth="2" fill="none" />
                </>
              ) : (
                <circle cx={p[0]} cy={p[1]} r={3} fill="var(--ar-accent)" opacity="0.5" />
              )}
            </g>
          );
        })}

        {labelIndices.map((i, li) => {
          const isFirst = li === 0;
          const isLast = li === labelIndices.length - 1;
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
          return (
            <text key={i} x={points[i][0]} y={h - 4}
              textAnchor={anchor} fontSize="9" fill="var(--ar-muted)"
              style={{ userSelect: 'none' }}>
              {fmtMonthLabel(startMonth, data[i].month)}
            </text>
          );
        })}
      </svg>

      {/* Overlay popup */}
      {popupData && (
        <div style={{
          position: 'absolute',
          left: popupLeft,
          top: popupTop,
          zIndex: 10,
          padding: '12px 14px',
          borderRadius: 12,
          background: 'var(--ar-bg)',
          border: '1px solid var(--ar-border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          minWidth: 200,
          pointerEvents: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--ar-muted)', fontWeight: 500 }}>
              {fmtMonthLabel(startMonth, popupData.month)}
            </span>
            <button
              onClick={() => setPopup(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'var(--ar-muted)', padding: 0 }}
            >×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Stat label="Savings balance" value={fmtCurrency(popupData.balance)} />
            <Stat label="Max home price" value={fmtCurrency(maxHomePrice)} />
            <div className="ar-stat">
              <div className="ar-stat-label">Monthly contribution</div>
              <div className="ar-stat-value ar-num">
                <EditableContrib contrib={popupData.contrib} monthIdx={popupData.month}
                  onOverride={(idx, v) => onOverride && onOverride(idx, v)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Savings table ───────────────────────────────────────────────────────────
function SavingsTable({ data, startMonth, downPct, onOverride }) {
  return (
    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
      <table className="ar-table">
        <thead>
          <tr>
            <th>Month</th>
            <th style={{ textAlign: 'right' }}>Contribution</th>
            <th style={{ textAlign: 'right' }}>Balance</th>
            <th style={{ textAlign: 'right' }}>Max home price</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => {
            const maxPrice = Math.floor(d.balance / ((downPct + CLOSING_PCT) / 100) / 1000) * 1000;
            return (
              <tr key={d.month}>
                <td style={{ fontWeight: 500 }}>
                  {fmtMonthLabel(startMonth, d.month)}
                </td>
                <td className="ar-num">
                  <EditableContrib
                    contrib={d.contrib}
                    monthIdx={d.month}
                    onOverride={onOverride}
                  />
                </td>
                <td className="ar-num" style={{ fontWeight: 600 }}>{fmtCurrency(d.balance)}</td>
                <td className="ar-num" style={{ fontWeight: 600 }}>{fmtCurrency(maxPrice)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Affordability heatmap ───────────────────────────────────────────────────
function Heatmap({
  timeline, startMonth, downPct,
  heatmapPriceMin, heatmapPriceMax, heatmapPriceIncrement,
  onPickMonth,
  selectedPurchaseMonth, selectedPrice,
}) {
  const [sel, setSel] = useState(null);

  const months = useMemo(() =>
    Array.from({ length: timeline.length }, (_, i) => i),
  [timeline.length]);

  const prices = useMemo(() => {
    const inc = Math.max(1000, heatmapPriceIncrement);
    const result = [];
    for (let p = heatmapPriceMin; p < heatmapPriceMax; p += inc) {
      result.push(Math.round(p / 1000) * 1000);
    }
    result.push(Math.round(heatmapPriceMax / 1000) * 1000);
    return result;
  }, [heatmapPriceMin, heatmapPriceMax, heatmapPriceIncrement]);

  const balances = useMemo(() => timeline.map(r => r.balance), [timeline]);

  const grid = useMemo(() =>
    prices.map(price => {
      const needed = price * (downPct + CLOSING_PCT) / 100;
      return months.map(m => {
        const balance = balances[m] ?? 0;
        const leftover = balance - needed;
        const feasible = leftover >= 0;
        const ratio = balance / Math.max(needed, 1);
        let monthsNeeded = null;
        if (!feasible) {
          for (let k = m + 1; k < balances.length; k++) {
            if (balances[k] >= needed) { monthsNeeded = k - m; break; }
          }
        }
        return { price, monthIdx: m, balance, needed, leftover, feasible, ratio, monthsNeeded };
      });
    }),
  [prices, months, balances, downPct]);

  const cols = months.length;

  return (
    <>
      {/* Selection banner */}
      {selectedPurchaseMonth && selectedPrice && (
        <div className="ar-card ar-card-accent ar-card-sm" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--ar-accent)', fontWeight: 500 }}>
            ✓ Buying in {selectedPurchaseMonth} · {fmtCurrency(selectedPrice)} at {downPct}% down
          </span>
        </div>
      )}

      {/* Scrollable grid */}
      <div className="ar-heatmap-scroll">
        <div className="ar-heatmap-inner">
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: `110px repeat(${cols}, 44px)`, gap: 6, marginBottom: 8 }}>
            <div />
            {months.map(m => (
              <div key={m} style={{ textAlign: 'center', fontSize: 11, color: 'var(--ar-muted)' }}>
                {fmtMonthLabel(startMonth, m)}
              </div>
            ))}
          </div>

          {/* Rows */}
          {grid.map((row, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: `110px repeat(${cols}, 44px)`, gap: 6, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 500 }}>
                {fmtCurrency(prices[ri], 0)}
              </div>
              {row.map((c, ci) => {
                const t = Math.max(0, Math.min(1, (c.ratio - 0.5) / 1.5));
                const bg = c.feasible
                  ? `color-mix(in oklch, var(--ar-accent) ${Math.round(15 + t * 70)}%, transparent)`
                  : `rgba(194,85,58,${(0.06 + (1 - c.ratio) * 0.18).toFixed(2)})`;
                const isSel = sel?.ri === ri && sel?.ci === ci;
                return (
                  <div
                    key={ci}
                    className="ar-heatcell"
                    onClick={() => {
                      const isAlreadySel = isSel;
                      setSel(isAlreadySel ? null : { ri, ci, c });
                      if (c.feasible && onPickMonth) {
                        onPickMonth(c);
                      }
                    }}
                    style={{
                      background: bg,
                      color: c.feasible && t > 0.4 ? 'white' : c.feasible ? 'var(--ar-fg)' : 'var(--ar-warn)',
                      outline: isSel ? '2px solid var(--ar-fg)' : 'none',
                      outlineOffset: 2,
                      cursor: 'pointer',
                    }}
                  >
                    {c.feasible ? '✓' : `${Math.round(c.ratio * 100)}%`}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected cell detail */}
      {sel && (
        <div style={{ marginTop: 16, padding: 20, borderRadius: 18, background: 'var(--ar-accent-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="ar-label">{fmtCurrency(sel.c.price)} · {fmtMonthLabel(startMonth, sel.c.monthIdx)}</div>
              <div className="ar-display" style={{
                fontSize: 26, marginTop: 6,
                color: sel.c.feasible ? 'var(--ar-pos)' : 'var(--ar-warn)',
              }}>
                {sel.c.feasible ? 'You can afford it.' : 'Not yet — keep saving.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <Stat label="You'll have" value={fmtCurrency(sel.c.balance)} />
              <Stat label={`Required (${downPct + CLOSING_PCT}%)`} value={fmtCurrency(sel.c.needed)} />
              {sel.c.feasible ? (
                <Stat label="Leftover" value={fmtCurrency(sel.c.leftover)} color="var(--ar-pos)" />
              ) : (
                <>
                  <Stat label="Short by" value={fmtCurrency(-sel.c.leftover)} color="var(--ar-warn)" />
                  {sel.c.monthsNeeded != null && (
                    <Stat label="Months to save" value={`+${sel.c.monthsNeeded} mo`} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Step1 ──────────────────────────────────────────────────────────────
export default function Step1({ data, onChange }) {
  const { progress, scenarios } = useApp();
  const vals = useMemo(
    () => ({ ...DEFAULT, ...data, overrides: data?.overrides || {} }),
    [data]
  );
  const [view, setView] = useState('graph');

  const set = (k, v) => onChange({ ...vals, [k]: v });

  const handleOverride = useCallback((monthIdx, value) => {
    onChange({
      ...vals,
      overrides: { ...vals.overrides, [monthIdx]: value },
    });
  }, [vals, onChange]);

  const timeline = useMemo(() =>
    buildSavingsTimeline(
      vals.initialSavings,
      vals.startMonth,
      vals.monthlyContrib,
      vals.projectionMonths,
      vals.overrides,
    ),
    [vals.initialSavings, vals.startMonth, vals.monthlyContrib, vals.projectionMonths, vals.overrides]
  );

  const projectedBalance = timeline[timeline.length - 1]?.balance ?? 0;

  const handlePickMonth = useCallback((c) => {
    const purchaseMonth = addMonths(vals.startMonth, c.monthIdx);
    onChange({
      ...vals,
      buyAtMonth: c.monthIdx,
      selectedBalance: c.balance,
      selectedPurchaseMonth: purchaseMonth,
      selectedPrice: c.price,
    });
  }, [vals, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Row 1: inputs + chart */}
      <div className="ar-grid-2">
        {/* Inputs */}
        <div className="ar-card" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div className="ar-label">Step 1 of 3 · Savings</div>
            <h2 className="ar-display" style={{ fontSize: 30, margin: '8px 0 0', fontWeight: 400 }}>Project your savings</h2>
          </div>
          {(() => {
            // Find most recent tracked balance across all scenarios by calendar date
            let latestCalMonth = null;
            let trackedBalance = null;
            for (const [sid, monthData] of Object.entries(progress || {})) {
              const sc = scenarios.find(s => s.id === sid);
              const startMonth = sc?.step1?.startMonth;
              if (!startMonth) continue;
              for (const [idxStr, balance] of Object.entries(monthData || {})) {
                const idx = parseInt(idxStr);
                if (idx < 0) continue;
                const calMonth = addMonths(startMonth, idx);
                if (!latestCalMonth || calMonth > latestCalMonth) {
                  latestCalMonth = calMonth;
                  trackedBalance = balance;
                }
              }
            }
            return (
              <SliderRow
                label="Starting balance" value={vals.initialSavings}
                min={0} max={200000} step={500}
                onChange={v => set('initialSavings', v)}
                display={fmtCurrency(vals.initialSavings)}
                editable
                syncValue={trackedBalance}
                syncLabel={trackedBalance != null ? `Use tracked: ${fmtCurrency(trackedBalance)}` : undefined}
              />
            );
          })()}
          <SliderRow
            label="Monthly contribution" value={vals.monthlyContrib}
            min={500} max={10000} step={50}
            onChange={v => set('monthlyContrib', v)}
            display={fmtCurrency(vals.monthlyContrib)}
            editable
          />
          <SliderRow
            label="Projection window" value={vals.projectionMonths}
            min={6} max={48} step={1}
            onChange={v => set('projectionMonths', v)}
            display={`${vals.projectionMonths} months`}
          />
          <SliderRow
            label="Down payment" value={vals.downPct}
            min={3} max={40} step={0.5}
            onChange={v => set('downPct', v)}
            display={`${vals.downPct}%`}
          />
          {/* Start month picker */}
          <div>
            <div className="ar-label" style={{ marginBottom: 8 }}>Start month</div>
            <MonthPicker value={vals.startMonth} onChange={v => set('startMonth', v)} />
          </div>
        </div>

        {/* Chart / table */}
        <div className="ar-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div className="ar-label">Projected · {vals.projectionMonths} months</div>
              <div className="ar-display ar-num" style={{ fontSize: 44, lineHeight: 1.05 }}>
                {fmtCurrency(projectedBalance)}
              </div>
            </div>
            <div className="ar-seg">
              <button className={`ar-seg-btn ${view === 'graph' ? 'active' : ''}`} onClick={() => setView('graph')}>Graph</button>
              <button className={`ar-seg-btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>Table</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {view === 'graph'
              ? (
                <SavingsCurve
                  data={timeline}
                  startMonth={vals.startMonth}
                  downPct={vals.downPct}
                  selectedMonthIdx={vals.buyAtMonth ?? null}
                  onOverride={handleOverride}
                />
              )
              : (
                <SavingsTable
                  data={timeline}
                  startMonth={vals.startMonth}
                  downPct={vals.downPct}
                  onOverride={handleOverride}
                />
              )
            }
          </div>
        </div>
      </div>

      {/* Affordability heatmap */}
      <div className="ar-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="ar-label">Affordability heatmap</div>
            <div style={{ fontSize: 13, color: 'var(--ar-muted)', marginTop: 4 }}>
              Click a feasible cell (✓) to set your purchase plan. Months match your projection window.
            </div>
          </div>
          <div className="ar-heatmap-controls" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: 'var(--ar-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Min
              <CurrencyInput className="ar-input" style={{ width: 110 }}
                value={vals.heatmapPriceMin}
                onChange={v => set('heatmapPriceMin', Math.round(v))} />
            </label>
            <label style={{ fontSize: 12, color: 'var(--ar-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Max
              <CurrencyInput className="ar-input" style={{ width: 110 }}
                value={vals.heatmapPriceMax}
                onChange={v => set('heatmapPriceMax', Math.round(v))} />
            </label>
            <label style={{ fontSize: 12, color: 'var(--ar-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Increment
              <select
                className="ar-input"
                style={{ width: 110 }}
                value={vals.heatmapPriceIncrement}
                onChange={e => set('heatmapPriceIncrement', parseInt(e.target.value))}
              >
                <option value={10000}>$10k</option>
                <option value={25000}>$25k</option>
                <option value={50000}>$50k</option>
                <option value={100000}>$100k</option>
              </select>
            </label>
          </div>
        </div>
        <Heatmap
          timeline={timeline}
          startMonth={vals.startMonth}
          downPct={vals.downPct}
          heatmapPriceMin={vals.heatmapPriceMin}
          heatmapPriceMax={vals.heatmapPriceMax}
          heatmapPriceIncrement={vals.heatmapPriceIncrement}
          onPickMonth={handlePickMonth}
          selectedPurchaseMonth={vals.selectedPurchaseMonth}
          selectedPrice={vals.selectedPrice}
        />
      </div>
    </div>
  );
}
