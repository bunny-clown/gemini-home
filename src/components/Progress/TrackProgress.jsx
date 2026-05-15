import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalHeader from '../Common/GlobalHeader';
import { useApp } from '../../contexts/AppContext';
import { buildSavingsTimeline, fmtCurrency, fmtMonthLabel, monthsBetween } from '../../utils/calculations';
import CurrencyInput from '../Common/CurrencyInput';
import MonthPicker from '../Common/MonthPicker';

const STANDALONE_ID = 'standalone';


/* ─── KPI card ─────────────────────────────────────────────────────────── */
function KPICard({ label, value, color }) {
  return (
    <div className="ar-card ar-card-sm">
      <div className="ar-label">{label}</div>
      <div
        className="ar-display ar-num"
        style={{ fontSize: 28, marginTop: 6, color: color || 'var(--ar-fg)' }}
      >
        {value}
      </div>
    </div>
  );
}

/* ─── SVG mini chart ────────────────────────────────────────────────────── */
function MiniChart({ data, width = 600, height = 180, buyAtMonth }) {
  const [popup, setPopup] = useState(null); // index

  if (!data || data.length < 2) return null;

  const projected = data.map(d => d.projected).filter(v => v != null);
  const actual    = data.map(d => d.actual).filter(v => v != null);
  const allVals   = [...projected, ...actual];
  const minVal    = Math.min(...allVals) * 0.95;
  const maxVal    = Math.max(...allVals) * 1.05;
  const range     = maxVal - minVal || 1;

  const padB = 24;
  const pad = { l: 20, r: 20, t: 12, b: padB };
  const W   = width  - pad.l - pad.r;
  const H   = height - pad.t - pad.b;

  const px = i => pad.l + (i / (data.length - 1)) * W;
  const py = v => pad.t + H - ((v - minVal) / range) * H;

  const projPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(d.projected).toFixed(1)}`)
    .join(' ');

  const projArea =
    `${projPath} L ${px(data.length - 1).toFixed(1)} ${(pad.t + H).toFixed(1)} L ${px(0).toFixed(1)} ${(pad.t + H).toFixed(1)} Z`;

  const actualPoints = data
    .map((d, i) => (d.actual != null ? { x: px(i), y: py(d.actual), i } : null))
    .filter(Boolean);

  const actualPath = actualPoints
    .map((pt, j) => `${j === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const labelStep = Math.max(1, Math.round(data.length / 6));
  const labelIdxs = [];
  for (let i = 0; i < data.length; i += labelStep) labelIdxs.push(i);
  if (labelIdxs[labelIdxs.length - 1] !== data.length - 1) labelIdxs.push(data.length - 1);

  const popupRow = popup != null ? data[popup] : null;
  const tooltipPct = popup != null ? Math.min(Math.max((px(popup) / width) * 100, 5), 55) : 0;

  return (
    <div style={{ position: 'relative' }} onClick={() => setPopup(null)}>
      <div className="ar-track-chart-scroll">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', cursor: 'pointer' }}
        onMouseLeave={() => setPopup(null)}>
        <defs>
          <linearGradient id="tpProjGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--ar-accent)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--ar-accent)" stopOpacity="0"    />
          </linearGradient>
        </defs>

        <path d={projArea} fill="url(#tpProjGrad)" />
        <path d={projPath} fill="none" stroke="var(--ar-accent)" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.65} />
        {actualPath && <path d={actualPath} fill="none" stroke="var(--ar-pos)" strokeWidth={2.5} />}

        {data.map((d, i) => (
          <g key={i}
            onClick={e => { e.stopPropagation(); setPopup(popup === i ? null : i); }}
            onMouseEnter={() => setPopup(i)}
            onTouchStart={e => { e.stopPropagation(); setPopup(i); }}
          >
            <circle cx={px(i)} cy={py(d.projected)} r={12} fill="transparent" />
            <circle cx={px(i)} cy={py(d.projected)} r={popup === i ? 5 : 3}
              fill="var(--ar-accent)"
              opacity={popup === i ? 1 : 0.35} />
          </g>
        ))}

        {actualPoints.map(pt => (
          <circle key={pt.i} cx={pt.x} cy={pt.y} r={4} fill="var(--ar-pos)" />
        ))}

        {buyAtMonth != null && buyAtMonth < data.length && (
          <g>
            <line
              x1={px(buyAtMonth)} y1={pad.t + 15}
              x2={px(buyAtMonth)} y2={pad.t + H}
              stroke="var(--ar-warn)" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8}
            />
            <rect
              x={px(buyAtMonth) - 24} y={pad.t - 1}
              width={48} height={14} rx={4}
              fill="var(--ar-warn)" opacity={0.15}
            />
            <text x={px(buyAtMonth)} y={pad.t + 10} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="var(--ar-warn)" style={{ userSelect: 'none' }}>
              PURCHASE
            </text>
          </g>
        )}

        {labelIdxs.map(i => (
          <text key={i} x={px(i)} y={height - 4} textAnchor="middle"
            fontSize="9" fill="var(--ar-muted)" style={{ userSelect: 'none' }}>
            {data[i].name}
          </text>
        ))}

      </svg>
      </div>
      {popupRow && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute',
          top: 8,
          left: `${tooltipPct}%`,
          background: 'var(--ar-bg)',
          border: '1px solid var(--ar-border)',
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 10,
          minWidth: 160,
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{popupRow.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ar-muted)' }}>
            Target: <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ar-fg)' }}>{fmtCurrency(popupRow.projected)}</span>
          </div>
          {popupRow.actual != null && (
            <div style={{ fontSize: 12, color: 'var(--ar-pos)', marginTop: 4 }}>
              Actual: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(popupRow.actual)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export default function TrackProgress() {
  const navigate   = useNavigate();
  const { scenarios, targetId, progress, updateProgress, standaloneConfig, setStandaloneConfig } = useApp();

  const hasScenarios = scenarios.length > 0;
  const [selectedId, setSelectedId] = useState(
    hasScenarios ? (targetId || scenarios[0]?.id || STANDALONE_ID) : STANDALONE_ID
  );

  const isStandalone = selectedId === STANDALONE_ID || !hasScenarios;
  const scenario = isStandalone ? null : scenarios.find(s => s.id === selectedId);
  const s1       = useMemo(() => scenario?.step1 || {}, [scenario]);

  const timeline = useMemo(() => {
    const cfg = isStandalone ? standaloneConfig : s1;
    if (!cfg) return [];
    return buildSavingsTimeline(
      cfg.initialSavings     || 0,
      cfg.startMonth         || new Date().toISOString().slice(0, 7),
      cfg.monthlyContrib     || 0,
      cfg.projectionMonths   || 36,
      isStandalone ? {} : (cfg.overrides || {})
    );
  }, [isStandalone, standaloneConfig, s1]);

  const trackingId = isStandalone ? STANDALONE_ID : selectedId;
  const actualByMonth = progress?.[trackingId] || {};

  const [showPrior, setShowPrior] = useState(false);
  const [extraPriorCount, setExtraPriorCount] = useState(0);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const startMonth = (isStandalone ? standaloneConfig.startMonth : s1.startMonth) || todayStr;
  const currentMonthIdx = Math.max(0, Math.min(monthsBetween(startMonth, todayStr), timeline.length - 1));

  /* Chart data */
  const chartData = timeline.map(row => ({
    name:      row.label,
    projected: Math.round(row.balance),
    actual:    actualByMonth[row.month] !== undefined ? actualByMonth[row.month] : null,
  }));

  /* KPI — only non-negative month indices */
  const enteredMonths = Object.keys(actualByMonth).map(Number).filter(n => n >= 0).sort((a, b) => a - b);
  const latestIdx     = enteredMonths.length > 0 ? enteredMonths[enteredMonths.length - 1] : -1;
  const savedYTD      = latestIdx >= 0 ? (actualByMonth[latestIdx] || 0) : 0;
  const targetYTD     = latestIdx >= 0 && timeline[latestIdx] ? timeline[latestIdx].balance : 0;
  const delta         = savedYTD - targetYTD;
  const onTrack       = delta >= 0;

  /* Row data */
  const mainRows = timeline.slice(currentMonthIdx, currentMonthIdx + 7);
  const priorTimelineRows = timeline.slice(0, currentMonthIdx);
  const negativeRows = Array.from({ length: extraPriorCount }, (_, i) => {
    const monthIdx = -(extraPriorCount - i);
    return { monthIdx, label: fmtMonthLabel(startMonth, monthIdx), balance: null };
  });
  const priorRows = [...negativeRows, ...priorTimelineRows];

  function handleAddPriorMonth() {
    setExtraPriorCount(c => c + 1);
    setShowPrior(true);
  }

  function renderRow(monthIdx, label, projectedBalance, isCurrent) {
    const projected = projectedBalance != null ? Math.round(projectedBalance) : null;
    const actual    = actualByMonth[monthIdx];
    const rowDelta  = actual !== undefined && projected !== null ? actual - projected : null;
    const hitRate   = actual !== undefined && projected !== null
      ? Math.min(100, (actual / Math.max(projected, 1)) * 100)
      : null;

    return (
      <tr
        key={monthIdx}
        className={isCurrent ? 'ar-track-current' : ''}
        style={isCurrent ? { background: 'var(--ar-accent-soft)' } : {}}
      >
        <td style={{ whiteSpace: 'nowrap' }}>{label}</td>
        <td style={{ textAlign: 'right' }} className="ar-num">
          {projected !== null ? fmtCurrency(projected) : '—'}
        </td>
        <td style={{ textAlign: 'right' }}>
          <CurrencyInput
            value={actual}
            onChange={v => updateProgress && updateProgress(trackingId, monthIdx, v)}
            onClear={() => updateProgress && updateProgress(trackingId, monthIdx, null)}
            className="ar-input ar-num ar-track-input"
          />
        </td>
        <td
          style={{
            textAlign: 'right',
            fontWeight: 500,
            color: rowDelta == null
              ? 'var(--ar-muted)'
              : rowDelta >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)',
          }}
          className="ar-num"
        >
          {rowDelta != null
            ? `${rowDelta >= 0 ? '+' : ''}${fmtCurrency(rowDelta)}`
            : '—'}
        </td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hitRate !== null ? (
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${hitRate}%`,
                  background: rowDelta >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
            ) : (
              <div style={{ flex: 1 }} />
            )}
          </div>
        </td>
      </tr>
    );
  }

  /* ── Standalone config card (shown when no scenario selected) ── */
  const standaloneConfigCard = isStandalone && (
    <div className="ar-card">
      <div className="ar-label" style={{ marginBottom: 12 }}>Savings plan · manual setup</div>
      <div className="ar-grid-2" style={{ gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ar-muted)', marginBottom: 6 }}>Start month</div>
          <MonthPicker
            value={standaloneConfig.startMonth}
            onChange={v => setStandaloneConfig(c => ({ ...c, startMonth: v }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ar-muted)', marginBottom: 6 }}>Starting balance ($)</div>
          <input
            type="number"
            className="ar-input ar-num"
            style={{ width: '100%', padding: '8px 12px' }}
            value={standaloneConfig.initialSavings}
            step={500}
            min={0}
            onChange={e => setStandaloneConfig(c => ({ ...c, initialSavings: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>
    </div>
  );

  /* ── Main view ────────────────────────────────────────────────────────── */
  return (
    <>
      <GlobalHeader />
      <div className="ar-scroll">
        <div className="ar-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Page header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="ar-label">Tracking</div>
              <h1 className="ar-display ar-track-title" style={{ fontSize: 44, fontWeight: 400, margin: '6px 0 0' }}>
                Actual vs target
              </h1>
            </div>

            {/* Scenario selector */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div className="ar-label" style={{ fontSize: 10, letterSpacing: '0.12em' }}>
                {hasScenarios ? 'COMPARING AGAINST' : 'MODE'}
              </div>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="ar-input"
                style={{ width: 220, fontSize: 14, fontWeight: 500 }}
              >
                {hasScenarios && scenarios.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name || 'Unnamed'}
                  </option>
                ))}
                <option value={STANDALONE_ID}>No scenario · manual</option>
              </select>
            </div>
          </div>

          {standaloneConfigCard}

          {/* 4 KPI summary cards */}
          <div className="ar-grid-4 ar-track-kpi">
            <KPICard label="Saved YTD" value={fmtCurrency(savedYTD)} />
            <KPICard label="Target YTD" value={fmtCurrency(targetYTD)} />
            <KPICard
              label="Delta"
              value={(delta >= 0 ? '+' : '') + fmtCurrency(delta)}
              color={delta >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'}
            />
            <KPICard
              label="Status"
              value={onTrack ? 'On track' : 'Behind'}
              color={onTrack ? 'var(--ar-pos)' : 'var(--ar-warn)'}
            />
          </div>

          {/* SVG chart card */}
          <div className="ar-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div className="ar-label">Projected vs actual savings</div>
              <div className="ar-track-legend" style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ar-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="20" height="10">
                    <line x1="0" y1="5" x2="20" y2="5" stroke="var(--ar-accent)" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.65" />
                  </svg>
                  Projected
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="20" height="10">
                    <line x1="0" y1="5" x2="20" y2="5" stroke="var(--ar-pos)" strokeWidth="2.5" />
                  </svg>
                  Actual
                </span>
                {!isStandalone && s1.buyAtMonth != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="20" height="10">
                      <line x1="10" y1="0" x2="10" y2="10" stroke="var(--ar-warn)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
                    </svg>
                    Purchase
                  </span>
                )}
              </div>
            </div>
            <div className="ar-track-chart-wrap">
              <MiniChart data={chartData} buyAtMonth={isStandalone ? null : (s1.buyAtMonth ?? null)} />
            </div>
          </div>

          {/* Monthly entries table */}
          <div className="ar-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div className="ar-label">Monthly entries</div>
              <div className="ar-track-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(currentMonthIdx > 0 || extraPriorCount > 0) && (
                  <button className="ar-btn ar-btn-ghost ar-btn-sm" onClick={() => setShowPrior(p => !p)}>
                    {showPrior ? 'Hide prior months' : 'Show prior months'}
                  </button>
                )}
                <button className="ar-btn ar-btn-ghost ar-btn-sm" onClick={handleAddPriorMonth}>
                  + Add prior month
                </button>
              </div>
            </div>
            <div className="ar-track-table-wrap">
              <table className="ar-table ar-track-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: 'right' }}>Target</th>
                    <th style={{ textAlign: 'right' }}>Actual</th>
                    <th style={{ textAlign: 'right' }}>&#916;</th>
                    <th style={{ minWidth: 120 }}>Hit rate</th>
                  </tr>
                </thead>
                <tbody>
                  {showPrior && priorRows.map(row => {
                    const monthIdx = row.monthIdx ?? row.month;
                    return renderRow(monthIdx, row.label, row.balance, false);
                  })}
                  {mainRows.map(row =>
                    renderRow(row.month, row.label, row.balance, row.month === currentMonthIdx)
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
